Created by 林永豪 on 五月 22, 2023

  [1. Overview（概述）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#1-overview%E6%A6%82%E8%BF%B0)  

1.update本地表filter子查询带远端表，支持，支持依赖于当前dblink select的支持范围。

2.实现单表update远端表。多表update拦截报错。

SR链接：    [YDBRD-13334](https://jira.yasdb.com/browse/YDBRD-13334?src=confmacro)    -  实现DBLINK的DML UPDATE单表能力  完成

##   [3. Interfaces（接口）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#3-interfaces%E6%8E%A5%E5%8F%A3)  

  


#### 语法形式：

  


  [4. Limitations（功能限制）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#4-limitations%E5%8A%9F%E8%83%BD%E9%99%90%E5%88%B6)  

1. update远端表，对update的filter有如下限制(与dblink单表delete filter 限制一样)：
1. *投影列，aggr聚集函数，窗口函数，子查询，sequence，udf在filter中出现当前会拦截报错
1. update远端表， filter中使用内置函数，按照yasdb内部函数进行校验，如yasdb内部没有实现的函数，校验报错。
1. 多表update


|  `vrfr->exclFlags =`      
    `    `      `EXPR_FLAG_STAR | EXPR_FLAG_AGGR | EXPR_FLAG_WIN_FUNC | EXPR_FLAG_SUBQUERY | EXPR_FLAG_SEQUENCE | EXPR_FLAG_UDF;`  |
|:---|


##   [5. Detail Design（详细设计）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

###   [5.1 Architecture（架构）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#51-architecture%E6%9E%B6%E6%9E%84)  

对于单表update， yasdb将完整的sql语句发送到yex_server,  yex_server调用odbc接口发送到oracle执行，并将oracle返回的执行结果返回给yasdb。

确认一下是不是原始sql。

**计划：delete/update走计划，拼成绑定参数形式**

###   [5.2 Data Structures & Flow（数据结构与流程）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#52-data-structures--flow%E6%95%B0%E6%8D%AE%E7%BB%93%E6%9E%84%E4%B8%8E%E6%B5%81%E7%A8%8B)  

CodResult verifyDblinkUpdate(AnlVerifier* vrfr, UpdateContext* context);

CodResult execDblinkUpdate(AnlStmt* stmt);

  


##   [6. Testcases（自测用例）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#6-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

1.update远端表不带filter。

2.update本地表 + filter 子查询里面有远端表查询(select * from 远端表，没有复杂子查询用例)。

3.update远端表+普通filter，以及filter里面有出现限制需要拦截报错用例。

4.多表update， 拦截报错。

5. expr里面使用函数：verify阶段会校验该函数是否合法，也就是如果yasdb没有实现的但是oracle有的函数，在dblink中使用是会报错的。

6.存储过程使用dblink 单表update， 包括有绑定参数的情况。

##   [7. Workload（工作量）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#7-workload%E5%B7%A5%E4%BD%9C%E9%87%8F)  

*评估代码量KLOC、工作量（人天）。*

##   [8. TODO（遗留问题）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#8-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

*说明本方案遗留的问题或下一步需要解决的问题。*