Created by 梁绮菁, last modified by  郑荃 on 十一月 13, 2023

# 1.概述

描述支持死锁检测后产生日志的测试设计

sr：    [YDBRD-15295](https://jira.yasdb.com/browse/YDBRD-15295?src=confmacro)    -  trace记录死锁信息  完成

设计文档：    [死锁检测](https://conf.yasdb.com/pages/viewpage.action?pageId=112726704)  

# 2.需求分析

支持死锁检测后，把死锁关系图、各session信息记录下来

# 3.测试设计方法

采用场景法测试，从用户角度出来，分析存在的死锁场景，查看是否能够正常现在检测并记录trance日志

死锁类型：行锁死锁、表锁死锁、xslot死锁

# 4.详细测试设计

|  
|锁类型|场景|用例|
|---|:---:|:---:|---|
|1|行锁|10个会话update/delete产生死锁,![](https://pingcode.yasdb.com/atlas/files/public/673969e08970c2af4f51fb11/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiSUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBRFFBQUFBSUFBb1EwQ0NBQUFBZ0FBQUFBQkFBQUFJQWdRZ0FBS0FBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQWlDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUJBRUFFQUFBQUFBZ0FBQUFBRUFBQUVBRUFBQUFBQUFBQUFBQkFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDk2NzYsImV4cCI6MTc4MjIyMDQ3Nn0.MAOQ2C9jra6gaECQVWqnr1PMMQoBBj3tXqJ7gasMhJ8)|drop table if exists tb_01;,create table tb_01(c1 int);,insert into tb_01 values(1),(2),(3),(4),(5),(6),(7),(8),(9),(10);,commit;,sessionA:,update tb_01 set c1=c1+1 where c1=1;,sessionB:,delete from tb_01 where c1=2;,sessionC:,update tb_01 set c1=c1+1 where c1=3;,sessionD:,delete from tb_01 where c1=4;,sessionE:,update tb_01 set c1=c1+1 where c1=5;,sessionF:,delete from tb_01 where c1=6;,sessionG:,update tb_01 set c1=c1+1 where c1=7;,sessionH:,delete from tb_01 where c1=8;,sessionI:,update tb_01 set c1=c1+1 where c1=9;,sessionJ:,delete from tb_01 where c1=10;,  
,sessionA:,update tb_01 set c1=c1+1 where c1=2;,sessionB:,delete from tb_01 where c1=3;,sessionC:,update tb_01 set c1=c1+1 where c1=4;,sessionD:,delete from tb_01 where c1=5;,sessionE:,update tb_01 set c1=c1+1 where c1=6;,sessionF:,delete from tb_01 where c1=7;,sessionG:,update tb_01 set c1=c1+1 where c1=8;,sessionH:,delete from tb_01 where c1=9;,sessionI:,update tb_01 set c1=c1+1 where c1=10;,sessionJ:,delete from tb_01 where c1=1;,  
|
|2|  
|5个会话update/delete产生死锁，连续产生死锁,![](https://pingcode.yasdb.com/atlas/files/public/673969e0a1ad9a3311dc7986/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiSUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBRFFBQUFBSUFBb1EwQ0NBQUFBZ0FBQUFBQkFBQUFJQWdRZ0FBS0FBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQWlDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUJBRUFFQUFBQUFBZ0FBQUFBRUFBQUVBRUFBQUFBQUFBQUFBQkFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDk2NzYsImV4cCI6MTc4MjIyMDQ3Nn0.MAOQ2C9jra6gaECQVWqnr1PMMQoBBj3tXqJ7gasMhJ8),  
,  
|drop table if exists tb_01;,create table tb_01(c1 int);,insert into tb_01 values(1),(2),(3),(4),(5);,commit;,sessionA:,update tb_01 set c1=c1+1 where c1=1;,sessionB:,delete from tb_01 where c1=2;,sessionC:,update tb_01 set c1=c1+1 where c1=3;,sessionD:,delete from tb_01 where c1=4;,sessionE:,update tb_01 set c1=c1+1 where c1=5;,  
,sessionA:,delete from tb_01 where c1=2 or c1=3;,sessionC  :,delete from tb_01 where c1=5;,sessionE  :,update tb_01 set c1=c1+1 where c1=4;,sessionB:,delete from tb_01 where c1=4 or c1=5;,sessionD:,update tb_01 set c1=c1+1 where c1=3;,  
,---产生死锁后，8,sessionD:,delete from tb_01 where c1=1;,  
,（A回滚，不等待B、C）,sessionA:,delete from tb_01 where c1=3;,update tb_01 set c1=c1+1 where c1=2;,  
,产生死锁后，9,sessionF:,insert into tb_01 values(6);,commit;,update tb_01 set c1=c1-1 where c1=6;,sessionD:,delete from tb_01 where c1=6;,sessionF:,update tb_01 set c1=c1+1 where c1=5;,  
|
|3|  
|![](https://pingcode.yasdb.com/atlas/files/public/673969e1a1ad9a3311dc7987/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiSUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBRFFBQUFBSUFBb1EwQ0NBQUFBZ0FBQUFBQkFBQUFJQWdRZ0FBS0FBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQWlDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUJBRUFFQUFBQUFBZ0FBQUFBRUFBQUVBRUFBQUFBQUFBQUFBQkFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDk2NzYsImV4cCI6MTc4MjIyMDQ3Nn0.MAOQ2C9jra6gaECQVWqnr1PMMQoBBj3tXqJ7gasMhJ8)|产生死锁后，8,sessionD:,update tb_01 set c1=c1+1 where c1=2;,  
,产生死锁后，9,sessionB:,commit;,sessionD:,delete from tb_01 where c1=1;|
|4|  
|100个会话产生死锁|  
|
|5|  
|101个会话产生死锁|  
|
|6|  
|select for update，多个表,![](https://pingcode.yasdb.com/atlas/files/public/673969e18970c2af4f51fb12/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiSUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBRFFBQUFBSUFBb1EwQ0NBQUFBZ0FBQUFBQkFBQUFJQWdRZ0FBS0FBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQWlDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUJBRUFFQUFBQUFBZ0FBQUFBRUFBQUVBRUFBQUFBQUFBQUFBQkFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDk2NzYsImV4cCI6MTc4MjIyMDQ3Nn0.MAOQ2C9jra6gaECQVWqnr1PMMQoBBj3tXqJ7gasMhJ8)|drop table if exists tb_01;,drop table if exists tb_02;,create table tb_01(c1 int,c2 varchar(20));,insert into tb_01 values(1,'tb1_01'),(2,'tb1_02'),(3,'tb1_03'),(6,'tb1_06'),(8,'abc_08');,commit;,create table tb_02(c1 int,c2 varchar(20));,insert into tb_02 values(1,'tb2_01'),(3,'tb2_03'),(4,'tb2_04'),(7,'tb2_07'),(8,'abc_08');,commit;,  
,sessionA:,select tb_01.c1,tb_01.c2,tb_02.c2 from tb_01 left join tb_02 on tb_01.c1=tb_02.c1 where tb_01.c1<=5 for update;,sessionB:,update tb_01 set c1=c1+1 where c1>=6;,delete from tb_02 where c1=1;,sessionC:,update tb_02 set c1=c1+1 where c1=7;,select tb_01.c1,tb_01.c2,tb_02.c2 from tb_01 cross join tb_02 where tb_01.c1=tb_02.c1 and tb_01.c1>=6 for update;,sessionA:,select tb_01.c1,tb_01.c2,tb_02.c2 from tb_01 right join tb_02 on tb_01.c1=tb_02.c1 for update;,  
,  
|
|7|xslot锁|2个xslot，3张表，3个会话,![](https://pingcode.yasdb.com/atlas/files/public/673969e1a1ad9a3311dc7988/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiSUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBRFFBQUFBSUFBb1EwQ0NBQUFBZ0FBQUFBQkFBQUFJQWdRZ0FBS0FBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQWlDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUJBRUFFQUFBQUFBZ0FBQUFBRUFBQUVBRUFBQUFBQUFBQUFBQkFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDk2NzYsImV4cCI6MTc4MjIyMDQ3Nn0.MAOQ2C9jra6gaECQVWqnr1PMMQoBBj3tXqJ7gasMhJ8)|--sessionA:    
  drop table testa;    
  create table testa(a int,b varchar(100));    
  begin    
  for i in 1 .. 400 loop    
  insert into testa values(i,i);    
  commit;    
  end loop;    
  end;    
  /,update testa set b='bbbbbbbbb';    
  commit;,--sessionB:,drop table testb;    
  create table testb(a int,b varchar(100));    
  begin    
  for i in 1 .. 400 loop    
  insert into testb values(i,i);    
  commit;    
  end loop;    
  end;    
  /,update testb set b='bbbbbbbbb';    
  commit;,  
,--sessionC:,drop table testc;    
  create table testc(a int,b varchar(100));    
  begin    
  for i in 1 .. 400 loop    
  insert into testc values(i,i);    
  commit;    
  end loop;    
  end;    
  /,update testc set b='bbbbbbbbb';    
  commit;,  
,--sessionA:    
  update testa set a=a+1 where a=1;    
  --sessionB：    
  update testb set a=a+1 where a=1;    
  --sessionC：    
  update testc set a=a+1 where a=1;,  
,--sessionA:    
  update testb set a=a+1 where a=2;    
  --sessionB：    
  update testc set a=a+1 where a=2;    
  --sessionC：    
  update testa set a=a+1 where a=2;,  
,  
  --sessionA:    
  update testc set a=a+1 where a=3;    
  --sessionB：    
  update testa set a=a+1 where a=3;    
  --sessionC：    
  update testb set a=a+1 where a=3;|
|8|  
|2个xslot，4张表，4个会话,![](https://pingcode.yasdb.com/atlas/files/public/673969e18970c2af4f51fb13/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiSUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBRFFBQUFBSUFBb1EwQ0NBQUFBZ0FBQUFBQkFBQUFJQWdRZ0FBS0FBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQWlDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUJBRUFFQUFBQUFBZ0FBQUFBRUFBQUVBRUFBQUFBQUFBQUFBQkFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDk2NzYsImV4cCI6MTc4MjIyMDQ3Nn0.MAOQ2C9jra6gaECQVWqnr1PMMQoBBj3tXqJ7gasMhJ8),  
|alter system set SQL_PLUGIN='mysql' scope = memory;,drop table if exists tb_01;    
  create table tb_01(c1 int,c2 varchar(100));    
  begin    
  for i in 1 .. 400 loop    
  insert into tb_01 values(i,i);    
  commit;    
  end loop;    
  end;    
  /,update tb_01 set c2='bbbbbbbbb';    
  commit;,drop table if exists tb_02;    
  create table tb_02(c1 int,c2 varchar(100));    
  begin    
  for i in 1 .. 400 loop    
  insert into tb_02 values(i,i);    
  commit;    
  end loop;    
  end;    
  /,update tb_02 set c2='bbbbbbbbb';    
  commit;,drop table if exists tb_03;    
  create table tb_03(c1 int,c2 varchar(100));    
  begin    
  for i in 1 .. 400 loop    
  insert into tb_03 values(i,i);    
  commit;    
  end loop;    
  end;    
  /,update tb_03 set c2='bbbbbbbbb';    
  commit;,drop table if exists tb_04;    
  create table tb_04(c1 int,c2 varchar(100));    
  begin    
  for i in 1 .. 400 loop    
  insert into tb_04 values(i,i);    
  commit;    
  end loop;    
  end;    
  /,update tb_04 set c2='bbbbbbbbb';    
  commit;,  
,sessionA:,update tb_01 set c1=c1+1 where c1=1;,sessionB:,update tb_04 set c1=c1+1 where c1=1;,sessionC:,update tb_03 set c1=c1+1 where c1=1;,sessionD:,update tb_02 set c1=c1+1 where c1=1;,sessionA:,update tb_03 set c1=c1+1 where c1=2;,sessionB:,update tb_01 set c1=c1+1 where c1=2;,sessionC:,update tb_02 set c1=c1+1 where c1=2;,update tb_04 set c1=c1+1 where c1=2;,  
,sessionA:,update tb_02 set c1=c1+1 where c1=3;,sessionB:,update tb_03,tb_02 set tb_03.c1=tb_03.c1+1,tb_02.c1=tb_02.c1+1 where tb_03.c1=tb_02.c1 and tb_03.c1=4;,sessionC:,update tb_01 set c1=c1+1 where c1=5;,sessionD:,update tb_03 set c1=c1+1 where c1=6;,  
,产生死锁后，6：,sessionA:,update tb_04 set c1=c1+1 where c1=7;,  
,产生死锁后，7：,sessionD:,update tb_04 set c1=c1+1 where c1=8;|
|9|表锁|后续补测|  
|
|10|行锁和xlsot锁|A拿了行锁，等待B的xslot,B等待A的行锁,![](https://pingcode.yasdb.com/atlas/files/public/673969e1a1ad9a3311dc7989/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiSUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBRFFBQUFBSUFBb1EwQ0NBQUFBZ0FBQUFBQkFBQUFJQWdRZ0FBS0FBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQWlDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUJBRUFFQUFBQUFBZ0FBQUFBRUFBQUVBRUFBQUFBQUFBQUFBQkFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDk2NzYsImV4cCI6MTc4MjIyMDQ3Nn0.MAOQ2C9jra6gaECQVWqnr1PMMQoBBj3tXqJ7gasMhJ8)|drop table tb_01;    
  create table tb_01(c1 int,c2 varchar(100));    
  begin    
  for i in 1 .. 400 loop    
  insert into tb_01 values(i,i);    
  commit;    
  end loop;    
  end;    
  /,update tb_01 set c2='bbbbbbbbb';    
  commit;,drop table tb_02;    
  create table tb_02(c1 int,c2 varchar(100));    
  begin    
  for i in 1 .. 400 loop    
  insert into tb_02 values(i,i);    
  commit;    
  end loop;    
  end;    
  /,update tb_02 set c2='bbbbbbbbb';    
  commit;,  
,sessionA:,update tb_01 set c1=c1+1 where c1=1;,sessionB:,update tb_02 set c1=c1+1 where c1=1;,sessionC:,update tb_02 set c1=c1+1 where c1=2;,  
,sessionA:,update tb_02 set c1=c1+1 where c1=3;,sessionB:,update tb_01 set c1=c1+1 where c1=1;|
|11|行锁和表锁|后续补测|  
|
|12|表锁和xlsot锁|后续补测|  
|


  


  


# 5.观测内容

1. 日志路径（记录在alter/log中）
1. 日志路径（在diag/trace下），日志命名
1. 锁id（xext+xnode+xsn）
1. 关系图是否正确
1. 各个字段是否正确（v$lock查看锁信息、v$session查看serial、v$transaction查看xext、xnode、xsn）


# 6.测试框架

手动测试

# 7.测试环境

|版本|环境|
|---|---|
|linux|单机|


## Attachments:

[image2023-6-8_16-26-52.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZGZhMWFkOWEzMzExZGM3OTdjIiwicmVmX2lkIjoiNjczOTY5ZGY3MjgyMDZlZmI5MmVmODc2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5Njc2LCJleHAiOjE3ODIyOTYwNzZ9.OvyDCuFCePIPIq7OQCBkMIeNNEXLBrpSBvmoQp-sWYQ)

 (image/png)    


[image2023-6-8_16-34-57.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZGY4OTcwYzJhZjRmNTFmYjA3IiwicmVmX2lkIjoiNjczOTY5ZGY3MjgyMDZlZmI5MmVmODc2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5Njc2LCJleHAiOjE3ODIyOTYwNzZ9.0UPsEJKOH8QLxzmVStporevvieeNhsb8MQ3IgEAyNJw)

 (image/png)    


[image2023-6-8_16-39-34.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZGY4OTcwYzJhZjRmNTFmYjA4IiwicmVmX2lkIjoiNjczOTY5ZGY3MjgyMDZlZmI5MmVmODc2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5Njc2LCJleHAiOjE3ODIyOTYwNzZ9.1_b8o_MIRY3Ay_cQfFtNbsGMKPFnZuEzUDkNX8eilNk)

 (image/png)    


[image2023-6-8_17-9-39.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZTA4OTcwYzJhZjRmNTFmYjA5IiwicmVmX2lkIjoiNjczOTY5ZGY3MjgyMDZlZmI5MmVmODc2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5Njc2LCJleHAiOjE3ODIyOTYwNzZ9.lrdTZkeTI3SjLyU3ewj9JrOdc7AYJBdY3EKaN_5eznA)

 (image/png)    


[image2023-6-8_17-10-41.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZTBhMWFkOWEzMzExZGM3OTdlIiwicmVmX2lkIjoiNjczOTY5ZGY3MjgyMDZlZmI5MmVmODc2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5Njc2LCJleHAiOjE3ODIyOTYwNzZ9.GOgKPXsWUTDhSKfZz_4E_42FP37ul0BpVSB6Hyd3AWo)

 (image/png)    


[image2023-6-8_17-58-52.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZTA4OTcwYzJhZjRmNTFmYjBhIiwicmVmX2lkIjoiNjczOTY5ZGY3MjgyMDZlZmI5MmVmODc2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5Njc2LCJleHAiOjE3ODIyOTYwNzZ9.mw574mEOGDDYgN7jguESuB_stvKl8gc3Fv11rDnEEYU)

 (image/png)    


[image2023-6-8_18-0-54.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZTBhMWFkOWEzMzExZGM3OTdmIiwicmVmX2lkIjoiNjczOTY5ZGY3MjgyMDZlZmI5MmVmODc2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5Njc2LCJleHAiOjE3ODIyOTYwNzZ9.2t2sTIKK-d6yOroWrXtyLGrkeuZPWDVcE6e6o2eBVQY)

 (image/png)    


[image2023-6-8_18-4-44.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZTBhMWFkOWEzMzExZGM3OTgwIiwicmVmX2lkIjoiNjczOTY5ZGY3MjgyMDZlZmI5MmVmODc2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5Njc2LCJleHAiOjE3ODIyOTYwNzZ9.0MwMynpU0XOCEyIDd_WWVVqfCRjkdD4PggvtkVWmyMo)

 (image/png)    


[image2023-6-8_18-5-9.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZTBhMWFkOWEzMzExZGM3OTgxIiwicmVmX2lkIjoiNjczOTY5ZGY3MjgyMDZlZmI5MmVmODc2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5Njc2LCJleHAiOjE3ODIyOTYwNzZ9.cQhr98a7wSlI-pyxN8xled5-0blTYK1Wnr228Dm8bN0)

 (image/png)    


[image2023-6-8_20-10-14.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZTA4OTcwYzJhZjRmNTFmYjBkIiwicmVmX2lkIjoiNjczOTY5ZGY3MjgyMDZlZmI5MmVmODc2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5Njc2LCJleHAiOjE3ODIyOTYwNzZ9.BwN6bHWlBWhF2BahzODNSm09TPSA0anCxRlSJyY2Us0)

 (image/png)    


[image2023-6-8_20-11-49.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZTA4OTcwYzJhZjRmNTFmYjBlIiwicmVmX2lkIjoiNjczOTY5ZGY3MjgyMDZlZmI5MmVmODc2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5Njc2LCJleHAiOjE3ODIyOTYwNzZ9.jc0cntue_JHBtdrCzlJQT9cpdlFPt3Sg1PJ22VoOObI)

 (image/png)    


[image2023-6-8_21-6-9.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZTBhMWFkOWEzMzExZGM3OTg0IiwicmVmX2lkIjoiNjczOTY5ZGY3MjgyMDZlZmI5MmVmODc2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5Njc2LCJleHAiOjE3ODIyOTYwNzZ9.kp3zmFfRHERbRlGCP9UdsX5VkTyxkAPgosF6cQ63kdM)

 (image/png)    


[image2023-6-9_11-17-49.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZTBhMWFkOWEzMzExZGM3OTg1IiwicmVmX2lkIjoiNjczOTY5ZGY3MjgyMDZlZmI5MmVmODc2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5Njc2LCJleHAiOjE3ODIyOTYwNzZ9.tAchqm_-z-3G7e81OcMUhDrDEkbsBfVuvCMPc_zyWhA)

 (image/png)    
