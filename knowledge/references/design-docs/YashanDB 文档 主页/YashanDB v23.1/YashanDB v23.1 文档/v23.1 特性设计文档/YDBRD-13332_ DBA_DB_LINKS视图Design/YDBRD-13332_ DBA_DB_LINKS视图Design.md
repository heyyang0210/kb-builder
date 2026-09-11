Created by 林永豪, last modified on 六月 08, 2023

  


#   [YDBRD-13332 : DBA_DB_LINKS Views Design（DBA_DB_LINKS三种视图方案设计）](#ydbrd-13332--dba-db-links-views-designdba-db-links三种视图方案设计)  

SR链接：    [YDBRD-13332](https://jira.yasdb.com/browse/YDBRD-13332)  

##   [1. Overview（概述）](#1-overview概述)  

提供DB LINK相关视图，可维可测。

##   [2. Features（功能特性）](#2-features功能特性)  

提供DB LINK相关视图，可维可测。

##   [3. Interfaces（接口）](#3-interfaces接口)  

无对外暴露接口

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

视图字段显示情况对齐oracle，功能上只支持OWNER / DB_LINK / USERNAME / HOST / CREATED / VALID

##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

###   [5.1 Architecture（架构）](#51-architecture架构)  

  [ORACLE DFX VIEWS对比文档](https://conf.yasdb.com/display/~linyonghao/db+link+DFX+views+cmp)  

```
// 参照oracle实现

SELECT * FROM dba_views WHERE view_name='DBA_DB_LINKS'

explain plan FOR select u.name, l.name, l.userid, l.host, l.ctime,
       decode(bitand(l.flag, 4), 4, 'YES', 'NO'),
       decode(bitand(l.flag, 8), 8, 'YES', 'NO'),
       decode(bitand(l.flag, 16), 16, 'NO', 'YES'),
       decode(bitand(l.flag, 32), 32, 'YES', 'NO')
from sys.link$ l, sys.user$ u
where l.owner# = u.user#

SELECT * FROM dbms_xplan.display();

SELECT * FROM dba_indexes WHERE rownum &lt;= 1;


SELECT * FROM dba_indexes WHERE table_name = 'LINK$';
select * from dba_ind_columns where table_name='LINK$';



```

###   [5.2 Data Structures & Flow（数据结构与流程）](#52-data-structures--flow数据结构与流程)  

```
create view DBA_DB_LINKS(OWNER,DB_LINK,USERNAME,HOST,CREATED,HIDDEN,SHARD_INTERNAL,VALID,INTRA_CDB) as
select u.name, l.name, l.userid, l.host, l.ctime,
       decode(bitand(l.flag, 4), 4, 'YES', 'NO'),
       decode(bitand(l.flag, 8), 8, 'YES', 'NO'),
       decode(bitand(l.flag, 16), 16, 'NO', 'YES'),
       decode(bitand(l.flag, 32), 32, 'YES', 'NO')
from sys.link$ l, sys.user$ u
where l.owner# = u.user#

create view ALL_DB_LINKS(OWNER,DB_LINK,USERNAME,HOST,CREATED,HIDDEN,SHARD_INTERNAL,VALID,INTRA_CDB) as
select u.name, l.name, l.userid, l.host, l.ctime,
       decode(bitand(l.flag, 4), 4, 'YES', 'NO'),
       decode(bitand(l.flag, 8), 8, 'YES', 'NO'),
       decode(bitand(l.flag, 16), 16, 'NO', 'YES'),
       decode(bitand(l.flag, 32), 32, 'YES', 'NO')
from sys.link$ l, sys.user$ u
where (l.OWNER# = userenv('SCHEMAID')
    OR l.OBJ# IN (SELECT UOR.OBJ# FROM SYS.USER_OBJROLES$ UOR WHERE USER# = userenv('SCHEMAID'))
    OR check_sys_privilege(l.OWNER#, 26) = 'TRUE')  --OBJECT_TYPE_DBLINK
  and l.owner# = u.user#
  
create view USER_DB_LINKS(DB_LINK,USERNAME,HOST,CREATED,HIDDEN,SHARD_INTERNAL,VALID,INTRA_CDB) as
  select l.name, l.userid, l.password, l.host, l.ctime,
       decode(bitand(l.flag, 4), 4, 'YES', 'NO'),
       decode(bitand(l.flag, 8), 8, 'YES', 'NO'),
       decode(bitand(l.flag, 16), 16, 'NO', 'YES'),
       decode(bitand(l.flag, 32), 32, 'YES', 'NO')
from sys.link$ l
where l.owner# = userenv('SCHEMAID')

```

###   [5.3 Compatibility（兼容性）](#53-compatibility兼容性)  

###   [5.4 DFX设计](#54-dfx设计)  

###   [5.5 其他](#55-其他)  

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

查询link相关视图

##   [7.资料设计章节](#7资料设计章节)  

##   [8. TODO（遗留问题）](#8-todo遗留问题)  