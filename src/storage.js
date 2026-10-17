// Identical synchronous transaction seam for Node SQLite and DO SQLite.
export class Storage {
 constructor(sql,transaction){this.sql=sql;this.transaction=transaction;this.sql('CREATE TABLE IF NOT EXISTS room_state (id INTEGER PRIMARY KEY CHECK(id=1), body TEXT NOT NULL)');}
 read(){const rows=this.sql('SELECT body FROM room_state WHERE id=1');return rows.length?JSON.parse(rows[0].body):null;}
 change(fn){return this.transaction(()=>{const {state,value}=fn(this.read());if(state)this.sql('INSERT INTO room_state(id,body) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body',JSON.stringify(state));return value;});}
}
