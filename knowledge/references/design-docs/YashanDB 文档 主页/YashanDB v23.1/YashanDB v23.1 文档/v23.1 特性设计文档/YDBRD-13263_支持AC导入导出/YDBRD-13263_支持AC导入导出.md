Created by 史鑫, last modified on 十月 15, 2024

##   [1. Overview（概述）](https://conf.yasdb.com/pages/viewpage.action?pageId=89094607#1-overview%E6%A6%82%E8%BF%B0)  

语法：    [CREATE ACCESS CONSTRAINT | YashanDB Doc (yasdb.com)](https://cod-doc.yasdb.com/yashandb/22.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/SQL%E8%AF%AD%E5%8F%A5/CREATE%20ACCESS%20CONSTRAINT.html)  

SR:    [[YDBRD-13263] 【imp/exp】支持AC导入导出 - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-13263)  

##   [2 规格说明](https://conf.yasdb.com/pages/viewpage.action?pageId=89094607#21-%E8%A7%84%E6%A0%BC%E8%AF%B4%E6%98%8E)  

  


##   [3. Interfaces（接口）](https://conf.yasdb.com/pages/viewpage.action?pageId=89094607#3-interfaces%E6%8E%A5%E5%8F%A3)  

  


##   [4. Limitations（功能限制）](https://conf.yasdb.com/pages/viewpage.action?pageId=89094607#4-limitations%E5%8A%9F%E8%83%BD%E9%99%90%E5%88%B6)  

  


##   [5. Detail Design（详细设计）](https://conf.yasdb.com/pages/viewpage.action?pageId=89094607#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

###   [5.1 Architecture（架构）](https://conf.yasdb.com/pages/viewpage.action?pageId=89094607#51-architecture%E6%9E%B6%E6%9E%84)  

####   [5.1.1 文件格式](#511-文件格式)  

#### 整体格式

放在表后，fromtable 导入/tables导出 跟表走。

#### 具体格式

act_ag+owern+tablename+sql_tag+sql。其中owern+tablename用于user/table模式导入跳转

#### 问题记录

一、问题：聚集列，范围列如何区分，accol$区分不开。    
  1.aggr语法：include sum(id5) as aaa, max(id6)，系统表作为列，如何导出？    
  2.count(*)的列是啥？自动生成的列。不管。    
  结论：导出列的顺序。accol$有6列。INCOLS=2，OUTCOLS=2，count(*),include。一定按照这个顺序导出。

二、依赖：AC是否存在依赖，针对AC创建AC。针对view创建AC。--均不行，因此不存在依赖排序

SQL> CREATE ACCESS CONSTRAINT ac2 FROM v1 ON id1 TO id2;

YAS-03002 cannot create access constraint on table with type 6

SQL> CREATE ACCESS CONSTRAINT ac2 FROM ac1 ON COL_1 TO COL_2;

YAS-03002 cannot create access constraint on table with type 9

三、ac的对象权是否导出

SQL> grant select on ac1 to user3;

YAS-00004 feature "privileges on specified object type" has not been implemented yet

ac没有单独的权限控制，现在只能dba大权限的user才能查

四、ac导入要不要强制alter table test_ac_lsc alter slice all stable

如果不强制slice，直接对ac的查询可能查不到。

与  梁桢灏讨论后，结论：不导出alter table test_ac_lsc alter slice all stable，原因如下：

1.ac的使用场景，大多是原表数据查询的加速。很少直接查询ac。建议不导出，后台自动生成ac数据。

####   [5.1.2 查询方式](#512-查询方式)  

  [AC 视图 - CoD SEG - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=85110182)  

|信息|视图|完整语句|关注点|
|---|---|---|---|
|  
|DBA_ACS|CREATE ACCESS CONSTRAINT   **ac2 FROM user2.t2**   ON id1 as alians_id1,id2 as alians_id2 TO id3*2 as alians_id3, id3+id4 as alians_id4 bound 10 where id5<10 and id5>1 and id6 is not null INCLUDE sum(id5) as aaa, max(id6) as bbb no order tablespace users;|1.schema大小写|
|  [xy_clause](https://cod-doc.yasdb.com/yashandb/22.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/SQL%E8%AF%AD%E5%8F%A5/CREATE%20ACCESS%20CONSTRAINT.html#xyclause)  |DBA_AC_COLUMNS|CREATE ACCESS CONSTRAINT ac2 FROM user2.t2 ON  ** id1 as alians_id1,id2 as alians_id2 TO id3*2 as alians_id3, id3+id4 as alians_id4**   bound 10 where id5<10 and id5>1 and id6 is not null INCLUDE sum(id5) as aaa, max(id6) as bbb no order tablespace users;|1.alian 不管系统/用户指定，全部导出|
|  [n_clause](https://cod-doc.yasdb.com/yashandb/22.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/SQL%E8%AF%AD%E5%8F%A5/CREATE%20ACCESS%20CONSTRAINT.html#nclause)  |DBA_ACS|CREATE ACCESS CONSTRAINT ac2 FROM user2.t2 ON id1 as alians_id1,id2 as alians_id2 TO id3*2 as alians_id3, id3+id4 as alians_id4   **bound 10**   where id5<10 and id5>1 and id6 is not null INCLUDE sum(id5) as aaa, max(id6) as bbb no order tablespace users;|不指定/指定|
|  [where_clause](https://cod-doc.yasdb.com/yashandb/22.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/SQL%E8%AF%AD%E5%8F%A5/CREATE%20ACCESS%20CONSTRAINT.html#whereclause)  |DBA_ACS|CREATE ACCESS CONSTRAINT ac2 FROM user2.t2 ON id1 as alians_id1,id2 as alians_id2 TO id3*2 as alians_id3, id3+id4 as alians_id4 bound 10   **where id5<10 and id5>1 and id6 is not null**   INCLUDE sum(id5) as aaa, max(id6) as bbb no order tablespace users;|不指定/指定|
|  [aggr_clause](https://cod-doc.yasdb.com/yashandb/22.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/SQL%E8%AF%AD%E5%8F%A5/CREATE%20ACCESS%20CONSTRAINT.html#aggrclause)  |DBA_AC_COLUMNS|CREATE ACCESS CONSTRAINT ac2 FROM user2.t2 ON id1 as alians_id1,id2 as alians_id2 TO id3*2 as alians_id3, id3+id4 as alians_id4 bound 10 where id5<10 and id5>1 and id6 is not null   **INCLUDE sum(id5) as aaa, max(id6) as bbb**   no order tablespace users;|1.聚集列规则，见问题记录|
|  [order_clause](https://cod-doc.yasdb.com/yashandb/22.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/SQL%E8%AF%AD%E5%8F%A5/CREATE%20ACCESS%20CONSTRAINT.html#orderclause)  |DBA_ACS SORTTYPE|CREATE ACCESS CONSTRAINT ac2 FROM user2.t2 ON id1 as alians_id1,id2 as alians_id2 TO id3*2 as alians_id3, id3+id4 as alians_id4 bound 10 where id5<10 and id5>1 and id6 is not null INCLUDE sum(id5) as aaa, max(id6) as bbb   **no order**   tablespace users;|不指定/指定|
|  [ac_attr_clause](https://cod-doc.yasdb.com/yashandb/22.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/SQL%E8%AF%AD%E5%8F%A5/CREATE%20ACCESS%20CONSTRAINT.html#acattrclause)  |DBA_ACS|CREATE ACCESS CONSTRAINT ac2 FROM user2.t2 ON id1 as alians_id1,id2 as alians_id2 TO id3*2 as alians_id3, id3+id4 as alians_id4 bound 10 where id5<10 and id5>1 and id6 is not null INCLUDE sum(id5) as aaa, max(id6) as bbb no order  ** tablespace users;**|1.tablespace --users/default/不指定|


系统表字段意义

|系统表|  
|意义|视图定义|
|---|---|---|---|
|AC$|NAME     
  ---------------    
  ID#     
  TABLE#     
  DATAOID#     
  TYPE#     
  COLS     
  INCOLS     
  OUTCOLS     
  SPACE#     
  INITRANS     
  MAXTRANS     
  PCTFREE     
  FLAGS     
  ENTRY     
  BOUND     
  SORTTYPE     
  FILTER     
  ROW_COUNT     
  LEAFBLOCK_COUNT    
  BLOCK_COUNT     
  DISTINCT_KEYS     
  BTREE_LEVEL     
  CLUSTER_FACTOR     
  ANALYZE_TIME     
  AVG_ROW_SIZE     
  SAMPLESIZE     
  COMPRESSION|ID# --obj$的obj#     
  TABLE# --tab$的OBJ#     
  DATAOID# --obj$的DATAOBJ#    
  TYPE# --DECODE(T.TYPE#, 0, 'AC_BTREE', 1, 'AC_ACOL')    
  COLS --直接取，应该不需要    
  INCOLS --直接取，应该不需要    
  OUTCOLS --直接取，应该不需要     
  SPACE# --转成name    
  INITRANS --TAB$.INITRANS    
  MAXTRANS --TAB$.MAXTRANS    
  PCTFREE --TAB$.PCTFREE    
  FLAGS --    
  ENTRY --不需要展示，数据的入口    
  BOUND --直接展示    
  SORTTYPE --DECODE(T.SORTTYPE, 0, 'ACOL_ORDER', 1, 'ACOL_UNORDER')    
  FILTER --直接展示    
  ROW_COUNT --以下全是null    
  LEAFBLOCK_COUNT     
  BLOCK_COUNT     
  DISTINCT_KEYS     
  BTREE_LEVEL     
  CLUSTER_FACTOR     
  ANALYZE_TIME     
  AVG_ROW_SIZE     
  SAMPLESIZE     
  COMPRESSION,**说明：**,1.对于col的ac，ROW_COUNT 及以下都是null。,2.对于Btree的ac，SORTTYPE 及以下都是null。,3.flag意义（acdesc）,CodUint32 flags;    
  struct {    
  CodUint32 isPart : 1;    
  CodUint32 isUnusable : 1;    
  CodUint32 isInvisible : 1;    
  CodUint32 verified : 1;    
  CodUint32 isGlobalStats : 1;    
  CodUint32 isUserStats : 1;    
  CodUint32 unused2 : 26;    
  };|CREATE OR REPLACE VIEW DBA_ACS(OWNER, AC_NAME, AC_TYPE, COLS, INCOLS, OUTCOLS, BOUND, SORTTYPE, FILTER, TABLE_OWNER, TABLE_NAME, TABLESPACE_NAME, INI_TRANS,    
  MAX_TRANS, PCT_FREE)     
  AS SELECT U.NAME, O.NAME, DECODE(A.TYPE#, 0, 'AC_BTREE', 1, 'AC_ACOL'), A.COLS, A.INCOLS, A.OUTCOLS, A.BOUND, DECODE(A.SORTTYPE, 0, 'ACOL_ORDER', 1, 'ACOL_UNORDER'), A.FILTER, IU.NAME, IO.NAME, TS.NAME, A.INITRANS, A.MAXTRANS, A.PCTFREE     
  FROM SYS.USER$ U, SYS.OBJ$ O, SYS.AC$ A,     
  SYS.USER$ IU, SYS.OBJ$ IO,     
  SYS.V$TABLESPACE TS    
  WHERE U.USER# = O.OWNER#    
  AND O.OBJ# = A.ID#    
  AND A.TABLE# = IO.OBJ#    
  AND IO.OWNER# = IU.USER#    
  AND A.SPACE# = TS.ID    
  /    
  CREATE OR REPLACE PUBLIC SYNONYM DBA_USERS FOR SYS.DBA_USERS    
  /|
|accol$|NAME     
  -------------    
  ACID#     
  TABLE#     
  COL#     
  POS#     
  FLAG     
  TYPE#     
  EXPRTEXT     
  ALIAS|ACID# --ac id     
  TABLE# -- table id     
  COL# --column id     
  POS# -- column position     
  FLAG -- 没用，写的0     
  TYPE# --列属性    
  EXPRTEXT --直接查     
  ALIAS --直接查|CREATE OR REPLACE VIEW DBA_AC_COLUMNS(OWNER, NAME, COLUMN_POSITION, COLUMN_EXPRTEXT, COLUMN_ALIAS) AS    
  SELECT U.NAME, O.NAME, AC.POS#, AC.EXPRTEXT, AC.ALIAS    
  FROM SYS.USER$ U, SYS.OBJ$ O, SYS.ACCOL$ AC    
  WHERE AC.ACID# =O.OBJ# AND U.USER#=O.OWNER#    
  /,CREATE OR REPLACE PUBLIC SYNONYM DBA_USERS FOR SYS.DBA_USERS    
  /    
  select * from DBA_AC_COLUMNS;|
|acpart$|NAME     
  -----------------    
  ID#     
  BO#     
  DATAOID#     
  PART#     
  SPACE#     
  FLAGS     
  ENTRY     
  ROW_COUNT     
  ANALYZE_TIME     
  AVG_ROW_SIZE     
  SAMPLESIZE     
  COMPRESSION|rowAddInt64(&rm, part->id); // obj id    
  rowAddInt64(&rm, desc->id); // ac id    
  rowAddInt64(&rm, part->dataOid); // data object id    
  rowAddInt64(&rm, part->partId); // part id    
  rowAddInt32(&rm, part->space); // tablespace    
  rowAddInt32(&rm, part->flags); // flags    
  rowAddInt32(&rm, part->entry.value); // entry    
  rowAddNull(&rm); //row count    
  rowAddNull(&rm); //analyze time    
  rowAddNull(&rm); //avg row size    
  rowAddNull(&rm); //sample size    
  rowAddNull(&rm); //compression|--,跟着表走，不能手动指定，因此先不展示。（paCreateAc）|


问题记录：

（1）AC的分区怎么导出？–不用导出，现在仅支持local，跟表走，且用户无法指定

（2）AC_BTREE/AC_ACOL区别。heap和tac默认创建的是Btree的ac，lsc是AC_ACOL，对外不可见，不用导出。

（3）alter slice是否导出。ac数据的生成（非元数据），全部走后台，导入导出不管。

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

1.列跟常数创建ac

```

```

##   [7. Workload（工作量）](#7-workload工作量)  

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

问题记录

  [1.ac](http://1.ac)    针对的对象。仅针对lsc表（heap/tac有限制，隐藏参数控制）？分布式/单机。    
    [2.ac](http://2.ac)    本身没有数据，仅元数据？（有数据，用于创建加速查询结构，类似索引）    
    [3.ac](http://3.ac)    和表/用户的关系。（不依附于表，有owner）    
    [4.ac](http://4.ac)    是否有访问权限控制。（暂时没做，应该和复用表的能力）    
  5.一个ac仅针对一张表？ac和表对关系是1：1？（一个ac针对一张表的多列）

6.ac支持分区。local跟表走

7.没有视图，系统表：  AC$ 、ACCOL$ 、ACPART$       [AC DDL方案设计 - CoD SEG - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=79957049)  

  [AC 测试设计 - CoD SEG - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=85115916)  

## Attachments:

[image2023-4-17_16-38-12.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZTA4OTcwYzJhZjRmNTFmZmMwIiwicmVmX2lkIjoiNjczOTZhZTA1OTNmOTljOWZmMjM1YWU2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjg5NzAyLCJleHAiOjE3ODIzNzYxMDJ9.xtkMEzEzJ-NZsdYA2ZvtTBpdu_Bkqa0a8FjqLKWqb90)

 (image/png)    


[image2023-4-3_18-17-33.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZTA4OTcwYzJhZjRmNTFmZmMxIiwicmVmX2lkIjoiNjczOTZhZTA1OTNmOTljOWZmMjM1YWU2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjg5NzAyLCJleHAiOjE3ODIzNzYxMDJ9.vmNNucBu8EC8PEq-xNaOkNj__eywG1EEIAE0mh49rJQ)

 (image/png)    
