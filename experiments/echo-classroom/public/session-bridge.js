let priorityReader=()=>null;
export function registerPriorityReader(reader){priorityReader=reader;}
export function prioritySnapshot(){return priorityReader();}
let toolReader=()=>null;
export function registerToolReader(reader){toolReader=reader;}
export function toolSnapshot(){return toolReader();}
export function externalTurnPending(){return !!toolReader()?.pending;}
