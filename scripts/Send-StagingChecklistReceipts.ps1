param(
    [Parameter(Mandatory)][Net.Mail.MailAddress]$Sender,
    [Parameter(Mandatory)][pscredential]$SmtpCredential
)

# Called by the existing staging mail worker after it has configured TLS and its restricted database role.
$productNames = @{
    'checklist' = 'IC / LC Inquiry Checklist'
    'compliance-checklist' = 'Compliance Checklist'
}
$approvedRecipients = @(
    'ankur.attorneyatlaw+navigator-hosted-owner@gmail.com',
    'ankur.attorneyatlaw+navigator-hosted-customer@gmail.com'
)

for ($index = 0; $index -lt 6; $index++) {
    $row = Invoke-MailDatabase 'select navigator_walkthrough_mail.claim_checklist_receipt();'
    if (!$row) { break }
    $job = $row | ConvertFrom-Json
    $order = [string]$job.order
    $attempt = [int]$job.attempt
    if ($order -cnotmatch '^order_[A-Za-z0-9]{1,40}$' -or $attempt -lt 1) {
        throw 'Invalid checklist receipt reference.'
    }
    $result = 'review'
    if ($productNames.ContainsKey([string]$job.product) -and $job.token -cmatch '^[a-f0-9]{64}$' -and
        $approvedRecipients -ccontains $job.email) {
        $name = $productNames[[string]$job.product]
        $link = 'https://posh-inquiry-navigator-staging.onrender.com/shop.html#resume=' + $job.token
        $amount = [int]$job.amount / 100
        $message = [Net.Mail.MailMessage]::new()
        $client = [Net.Mail.SmtpClient]::new('smtp.hostinger.com', 587)
        try {
            $message.From = $Sender
            $message.To.Add([Net.Mail.MailAddress]::new($job.email))
            $message.Subject = 'Navigator staging test receipt - ' + $name
            $message.Body = @"
Your test order is complete.

Product: $name
Order: $order
Catalogue price: INR $amount
Amount charged: INR 0
This staging receipt is not a tax invoice.

Open or resume this purchase:
$link

Keep this link private. It opens this checklist purchase only and does not grant Navigator plan access.

The Cosmic Energizers
"@
            $client.EnableSsl = $true
            $client.Credentials = $SmtpCredential.GetNetworkCredential()
            $client.Timeout = 15000
            $client.Send($message)
            $result = 'sent'
        } catch {
            # An ambiguous SMTP error can follow acceptance. Keep it for review instead of resending.
            $cause = $_.Exception
            while ($cause.InnerException -and $cause -isnot [Net.Mail.SmtpException]) {
                $cause = $cause.InnerException
            }
            if ($cause -is [Net.Mail.SmtpException] -and [int]$cause.StatusCode -in @(421, 450, 451, 452)) {
                $result = 'retry'
            }
        } finally {
            $message.Dispose()
            $client.Dispose()
        }
    }
    $recorded = Invoke-MailDatabase "select navigator_walkthrough_mail.finish_checklist_receipt('$order',$attempt,'$result');"
    if ($recorded -ne 't') { throw 'Checklist receipt result could not be recorded.' }
    Write-MailLog "checklist_receipt $result"
}
