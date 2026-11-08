'use strict';
const stagingOrigin='https://posh-inquiry-navigator-staging.onrender.com';
function planStoreFromEnvironment({
  origin=process.env.RENDER_EXTERNAL_URL,
  url=process.env.NAVIGATOR_AUTH_URL,
  key=process.env.NAVIGATOR_AUTH_PUBLISHABLE_KEY,
  token=process.env.NAVIGATOR_CHECKLIST_STORE_TOKEN,
  fetchImpl=fetch
}={}){
  if(origin!==stagingOrigin||!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url||'')||!key||! /^[a-f0-9]{64}$/.test(token||''))return null;
  return async (buyer,action,params={})=>{
    if(!buyer.accessToken)throw Error('Verified account required');
    const response=await fetchImpl(url+'/rest/v1/rpc/navigator_plan_test_access',{
      method:'POST',headers:{apikey:key,Authorization:'Bearer '+buyer.accessToken,'Content-Type':'application/json'},
      body:JSON.stringify({p_token:token,p_action:action,...params}),signal:AbortSignal.timeout(8000)
    });
    if(!response.ok)throw Error('Plan activation store unavailable');
    return response.json();
  };
}
module.exports={stagingOrigin,planStoreFromEnvironment};
