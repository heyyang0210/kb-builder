Created by 胡波洋, last modified on 七月 14, 2023

  [1. Overview（概述）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#1-overview%E6%A6%82%E8%BF%B0)  

1.实现insert 本地表select 远端表（这个在dblink select能力支持后天然支持）。

2.实现insert远端表select（本地表或者远端表的组合)。

SR链接：       [YDBRD-13331](https://jira.yasdb.com/browse/YDBRD-13331?src=confmacro)    -  实现DBLINK INSERT INTO SELECT能力  完成

##   [3. Interfaces（接口）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#3-interfaces%E6%8E%A5%E5%8F%A3)  

  


#### 语法形式：

1.  insert 本地表select 远端表：insert into tb1 select * from tb2@test_dblink;  // 其中test_dblink为本地数据库到远端数据库的dblink 链接名字
1. 实现insert远端表select : insert into tb2@test_dbnlink select * from tb1;


  


  [4. Limitations（功能限制）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#4-limitations%E5%8A%9F%E8%83%BD%E9%99%90%E5%88%B6)  

##   [5. Detail Design（详细设计）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

###   [5.1 Architecture（架构）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#51-architecture%E6%9E%B6%E6%9E%84)  

1. insert into tb1 select xx from tb2; 将用户输入的原始insert select语句改写成insert into tb1 values(:1, :2, :3); 语句，其中绑定参数的个数由insert 所跟的select 投影列列数决定。 


      2. 在当前已实现的blink select的基础上，本地数据库执行select， 将select的结果集作为上述改写后语句的绑定参数发送到远端数据库。

      3. 由于该实现将用户写的单条sql语句改写成上述形式，实际在远端执行了多次， 为保证一致性，如果发生错误，需要将远端数据库已经插入的数据进行回滚。本SR通过在向远端插入数据之前, 先向远端数据库发送save point xx, 

如果执行过程中发生错误，向远端数据库执行rollback to xx; 从而实现该语句的一致性。

###   [5.2 Data Structures & Flow（数据结构与流程）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#52-data-structures--flow%E6%95%B0%E6%8D%AE%E7%BB%93%E6%9E%84%E4%B8%8E%E6%B5%81%E7%A8%8B)  

static CodResult dblinkInsertSelect(AnlStmt* stmt, YlnCursor* cursor, InsertPlan* plan)

##   [6. Testcases（自测用例）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#6-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

1. 基本功能用例
1. 执行过程中发生错误，成功回滚。


  


##   [7. Workload（工作量）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#7-workload%E5%B7%A5%E4%BD%9C%E9%87%8F)  

*评估代码量KLOC、工作量（人天）。*

##   [8. TODO（遗留问题）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#8-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

*说明本方案遗留的问题或下一步需要解决的问题。*