import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

for (const name of ["autovision", "autovision-existing"]) {
  test(name + " judge deployment has bounded demo, Nova permissions and MCP routing", () => {
    const t = JSON.parse(readFileSync("devops/cloudformation/" + name + ".yaml", "utf8"));
    assert.equal(t.Parameters.PublicDemoDailyLimit.Default, 100);
    assert.equal(t.Parameters.VisionAIEnabled.Default, "true");
    assert.equal(t.Parameters.VisionBackend.Default, "standard");
    assert.deepEqual(t.Parameters.VisionBackend.AllowedValues, ["standard","cool"]);
    assert.ok(t.Rules.CoolRequiresEndpoint);
    for(const task of ["ApiTask","WorkerTask"]){
      const containers=t.Resources[task].Properties.ContainerDefinitions;
      assert.ok(containers.some((c:Record<string,unknown>)=>JSON.stringify(c).includes('"AWS::NoValue"')));
      const env=containers[0].Environment;
      assert.deepEqual(env.find((e:{Name:string})=>e.Name==='AUTOVISION_VISION_URL').Value,{'Fn::If':['UseCool',{Ref:'CoolVisionUrl'},'http://localhost:8000']});
    }
    const policy = t.Resources.VisionBedrockAccess;
    assert.equal(policy.Condition, "UseVisionAI");
    assert.equal(policy.Properties.PolicyDocument.Statement[0].Action, "bedrock:InvokeModel");
    assert.ok(JSON.stringify(policy).includes("bedrock:InferenceProfileArn"));
    for (const task of ["WebTask", "ApiTask"]) {
      const env = t.Resources[task].Properties.ContainerDefinitions[0].Environment;
      assert.ok(env.some((e: {Name: string}) => e.Name === "AUTOVISION_VISION_MODEL_ID"));
      assert.ok(env.some((e: {Name: string}) => e.Name === "AUTOVISION_PUBLIC_DEMO_DAILY_LIMIT"));
    }
    const rules = Object.values(t.Resources) as {Type: string; Properties: {Conditions?: unknown[]}}[];
    assert.ok(rules.filter(r => r.Type === "AWS::ElasticLoadBalancingV2::ListenerRule").some(r => JSON.stringify(r.Properties.Conditions).includes('"/mcp"')));
  });
}
