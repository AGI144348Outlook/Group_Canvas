let priorityReader=()=>null;
export function registerPriorityReader(reader){priorityReader=reader;}
export function prioritySnapshot(){return priorityReader();}
