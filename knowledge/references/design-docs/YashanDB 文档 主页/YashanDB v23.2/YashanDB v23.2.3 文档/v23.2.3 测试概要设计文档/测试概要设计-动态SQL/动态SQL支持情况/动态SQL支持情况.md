Created by 张欣, last modified on 一月 24, 2024

|编号|  
|场景|yashan表现|Oracle表现|
|---|---|---|---|---|
|1|execute immediate|动态语句执行静态SQL |支持|支持|
|2|  
|dynamic_returning_clause|不支持|支持|
|3|  
|动态语句执行（带形参的）过程体调用|标量类型支持，实参传复合类型（record，udt）会core ,  [YDBRD-25415](https://jira.yasdb.com/browse/YDBRD-25415?src=confmacro)    -  【质量加固】【 动态SQL 】绑定参数为record变量，同时作为参数使用core在了soInitVarlenRef  解决关闭|支持|
|4|  
|动态语句执行匿名块-声明单元-default值|标量类型支持，复合类型不支持,  点击此处展开...,create     type   obj_type_dyn_50   as   object(c1 int,c2   varchar  (  200  ))     
  /,declare    
  a obj_type_dyn_50 := obj_type_dyn_50(22,'7e9');    
  v_sql clob := '    
  declare    
  a1 obj_type_dyn_50 default :x1;    
  begin    
  null;    
  end;';    
  begin    
  execute immediate v_sql using a;    
  end;    
  / 2 3 4 5 6 7 8 9 10 11 12,YAS-04253 PL/SQL compiling errors:    
  [12:28] YAS-00014 illegal conversion from - to OBJ_TYPE_DYN_50,  
|支持|
|5|  
|动态语句执行匿名块-声明单元-cursor声明|不支持,cursor的select list 传入绑定参数会core,  [YDBRD-26048](https://jira.yasdb.com/browse/YDBRD-26048?src=confmacro)    -  【质量加固】【动态SQL】显式游标声明，select list传入绑定变量core在soCopyTypeDesc  解决关闭,修改后:   feature "variable binding to cursor select column position" has not been implemented yet|支持|
|6|  
|动态语句执行匿名块-执行单元-赋值|标量类型支持，复合类型不支持,  点击此处展开...,DECLARE    
  a obj_type_dyn_50 := obj_type_dyn_50(22,'7e9');    
  begin    
  execute immediate 'declare b obj_type_dyn_50;    
  begin    
  b := :x1;    
  dbms_output.put_line(b.c1||b.c2);    
  end;' using a;    
  end;    
  / 2 3 4 5 6 7 8 9 10,YAS-04253 PL/SQL compiling errors:    
  [6:8] YAS-00014 illegal conversion from - to OBJ_TYPE_DYN_50|支持|
|7|  
|动态语句执行匿名块-执行单元-select into|标量类型支持，复合类型不支持,  点击此处展开...,DECLARE    
  a obj_type_dyn_50 := obj_type_dyn_50(22,'7e9');    
  begin    
  execute immediate 'declare b obj_type_dyn_50;    
  begin select :x1 into b from dual;    
  dbms_output.put_line(b.c1||b.c2);    
  end;' using a;    
  end;    
  / 2 3 4 5 6 7 8 9,YAS-04253 PL/SQL compiling errors:    
  [5:25] YAS-00014 illegal conversion from - to OBJ_TYPE_DYN_50|支持,  点击此处展开...,DECLARE    
  a obj_type_dyn_50 := obj_type_dyn_50(22,'7e9');    
  begin    
  execute immediate 'declare b obj_type_dyn_50;    
  begin select :x1 into b from dual;    
  dbms_output.put_line(b.c1||b.c2);    
  end;' using a;    
  end;    
  / 2 3 4 5 6 7 8 9     
  227e9,PL/SQL procedure successfully completed.|
|8|  
|动态语句执行匿名块-执行单元-select bulk collection into|会core,  [YDBRD-26424](https://jira.yasdb.com/browse/YDBRD-26424?src=confmacro)    -  【质量加固】【动态SQL】动态执行select bulk collection into 绑定变量多个场景core在soGetVarrayMemberDef  解决关闭|支持|
|9|  
|动态语句执行匿名块-执行单元-fetch into|不支持 游标变量绑定参数传入,  [YDBRD-26186](https://jira.yasdb.com/browse/YDBRD-26186?src=confmacro)    -  【质量加固】【动态SQL】fetch 使用的游标变量用绑定参数传入不识别  问题已转需求|支持|
|10|  
|动态语句执行匿名块-执行单元-流程控制|待测试|  
|
|11|  
|动态语句执行匿名块-异常处理单元|待测试|  
|
|12|游标open 动态sql|  
|支持|支持|
|13|DBMS_SQL高级包|  
|不支持|支持|
