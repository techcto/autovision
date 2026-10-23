// Explicit same-origin destinations accepted after authentication.
export function returnPath(next:string|null|undefined){return next&&['/dashboard','/settings/account-deletion','/settings/data-deletion','/settings/billing','/analyze','/api-reference','/docs/mcp'].includes(next)?next:null;}
