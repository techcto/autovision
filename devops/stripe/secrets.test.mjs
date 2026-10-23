import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
for(const name of ['autovision.yaml','autovision-existing.yaml']){
 const template=JSON.parse(readFileSync(new URL('../cloudformation/'+name,import.meta.url)));
 test(name+': install secrets are retained, encrypted and not plain task environment values',()=>{
  assert.equal(template.Parameters.StripeMode.Default,'live');
  assert.deepEqual(template.Parameters.StripeMode.AllowedValues,['live','sandbox']);
  for(const id of ['RootPasswordSecret','SessionSigningSecret','StripeCredentials']){
   const resource=template.Resources[id];assert.equal(resource.Type,'AWS::SecretsManager::Secret');
   assert.equal(resource.DeletionPolicy,'RetainExceptOnCreate');assert.equal(resource.UpdateReplacePolicy,'Retain');
   assert.ok(resource.Properties.KmsKeyId);assert.ok(!resource.Properties.GenerateSecretString);
  }
  let mainContainers=0;
  for(const resource of Object.values(template.Resources)){
   if(resource.Type!=='AWS::ECS::TaskDefinition')continue;
   for(const container of resource.Properties.ContainerDefinitions){
    if(!container.Environment)continue;mainContainers++;
    assert.ok(container.Environment.some(value=>value.Name==='AUTOVISION_STRIPE_MODE'&&value.Value.Ref==='StripeMode'));
    for(const key of ['AUTOVISION_ROOT_PASSWORD','AUTOVISION_SESSION_SECRET','STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET']){
     assert.ok(!container.Environment.some(value=>value.Name===key));
     assert.ok(container.Secrets.some(value=>(value.Name??value['Fn::If']?.[1]?.Name)===key));
    }
    assert.ok(container.Environment.some(value=>value.Name==='AUTOVISION_PUBLIC_ORIGIN'));
    assert.ok(container.Environment.some(value=>value.Name==='AUTOVISION_BLOCKED_SIGNUP_DOMAINS'));
   }
  }
  assert.equal(mainContainers,3);
  assert.ok(template.Rules.SaasEmailSenderRequired);assert.ok(template.Rules.StripeCredentialSource);
  assert.ok(!JSON.stringify(template.Resources.ExecutionRole).includes('ProviderEncryptionSecret'));
  assert.ok(!JSON.stringify(template).includes('SMARTDETECTOR_'));
  assert.deepEqual(template.Resources.SessionSigningSecret.Properties.SecretString,{Ref:'SessionSecret'});
  assert.deepEqual(template.Resources.RootPasswordSecret.Properties.SecretString,{Ref:'RootPassword'});
 });
}
