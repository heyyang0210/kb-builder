Created by 林俊喆, last modified on 六月 01, 2023

#   [YDBRD-6636：分布式支持dv$视图之间的join](#ydbrd-6636分布式支持dv视图之间的join)  

  [https://jira.yasdb.com/browse/YDBRD-6636](https://jira.yasdb.com/browse/YDBRD-6636)  

##   [1. Overview（概述）](#1-overview概述)  

目标是分布式支持dv$视图和dv$视图之间、dv$视图和系统表之间做join。CN下发一份本地的执行计划到所有节点，各节点收集本地的数据后汇总到CN。

主要有两条sql语句需要能够支持：

```
select sql_text from dv$sql,dv$session where dv$session.user_name=’USER1’ and dv$sql.sql_id = dv$session.sql_id;
select dv$sql.sql_id,exec_start_time,elapsed_time,sql_text,username from
dv$sql,dv$session where dv$sql.sql_id = dv$session.sql_id;

```

##   [2. Features（功能特性）](#2-features功能特性)  

  [https://cod-doc.yasdb.com/yashandb/alpha/zh/%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E7%B3%BB%E7%BB%9F%E8%A7%86%E5%9B%BE/%E5%8A%A8%E6%80%81%E8%A7%86%E5%9B%BE/00%E5%8A%A8%E6%80%81%E8%A7%86%E5%9B%BE.html](https://cod-doc.yasdb.com/yashandb/alpha/zh/%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E7%B3%BB%E7%BB%9F%E8%A7%86%E5%9B%BE/%E5%8A%A8%E6%80%81%E8%A7%86%E5%9B%BE/00%E5%8A%A8%E6%80%81%E8%A7%86%E5%9B%BE.html)     所列的dv$视图之间支持多表连接。

##   [3. Interfaces（接口）](#3-interfaces接口)  

无

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

1. 对dv$视图的所有操作都在收到计划的节点本地执行，最后再汇总到CN，不同节点间的数据不做任何关联聚集操作。
1. order by，group by，窗口函数，聚集函数，limit，rownum 都只在收到计划的节点内生效，CN只做汇总。order by在CN汇总后可能不是有序的；group by可能有重复的；limit限制各节点的条数，最终CN返回的是节点数*limit数。
1. dv$和DBA视图、dv$和系统表、dv$和v$，升级处理。对DBA视图、系统表，使用的都是各节点本地的数据；v$视图按dv$视图处理，等同于各节点的v$。
1. 只允许和DBA视图、USER视图、ALL视图、系统表、v$之间join。
1. DN上plan cache可能膨胀到多CN之和。在CN扩容时建议增加share_pool_size。


##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

##   [5.1 Architecture（架构）](#51-architecture架构)  

![](https://git.yasdb.com/linjunzhe/pics/-/raw/main/pictures/2023/05/31_10_1_17_20230531100114.png?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTMxOTEsImV4cCI6MTc4MjIyMzk5MX0.CA6nEnXED4M3OCy-XiLK_4GBc87lhuNGDbofWocGdxw)

每个节点拿到一份本地的执行计划，上面是一个pxSender，用于将数据汇总到CN；CN只接收所有DN上的数据，不做任何处理。

生成的计划如下图所示：

![](https://git.yasdb.com/linjunzhe/pics/-/raw/main/pictures/2023/05/31_10_20_37_20230531102034.png?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTMxOTEsImV4cCI6MTc4MjIyMzk5MX0.CA6nEnXED4M3OCy-XiLK_4GBc87lhuNGDbofWocGdxw)

##   [5.2 DN上启用plan cache](#52-dn上启用plan-cache)  

  [https://conf.yasdb.com/pages/viewpage.action?pageId=109591974](https://conf.yasdb.com/pages/viewpage.action?pageId=109591974)  

主要是要支持分布式下sql，sql_area，sql_plan等一系列sql相关视图能查询到DN上的信息。

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

```
explain select dv$sqlarea.group_id, dv$sql.sql_text from dv$sql, dv$sqlarea where dv$sql.sql_id = dv$sqlarea.sql_id order by dv$sql.group_id;
explain select * from dv$sql, ( select group_id , count(group_id) from dv$sqlarea group by group_id) t1 where dv$sql.group_id = t1.group_id;
explain select * from dv$sql, ( select group_id , count(group_id) from dv$sqlarea order by group_id) t1 where dv$sql.group_id = t1.group_id;
explain select * from dv$sql, dv$sqlarea where dv$sql.sql_id = dv$sqlarea.sql_id limit 1;
explain select count(group_id) from dv$sql, ( select group_id , count(group_id) from dv$sqlarea order by group_id) t1 where dv$sql.group_id = t1.group_id;
explain select distinct group_id from dv$sql, ( select group_id , count(group_id) from dv$sqlarea order by group_id) t1 where dv$sql.group_id = t1.group_id;

```

##   [7. Document（资料）](#7-document资料)  

无

##   [8. Workload（工作量）](#8-workload工作量)  

5人天

##   [9. TODO（遗留问题）](#9-todo遗留问题)  

###   [9.1 DN上启用plan cache后](#91-dn上启用plan-cache后)  

1. 多CN下，DN的SQL_POOL需要容纳多个CN生成的计划，按照CN间生成的计划不复用，DN的SQL_POOL需求峰值可能会膨胀到CN的总和。需要一个快速校验值来标识计划是否一致。
1. 当前计划在CN上的plan cache中不能保证其一定在DN上的plan cache中，因此无论能否复用，CN都会把计划发给DN。


###   [9.2 指定节点只能靠dv$视图的字段过滤，无法指定到某个节点执行。](#92-指定节点只能靠dv视图的字段过滤无法指定到某个节点执行)  