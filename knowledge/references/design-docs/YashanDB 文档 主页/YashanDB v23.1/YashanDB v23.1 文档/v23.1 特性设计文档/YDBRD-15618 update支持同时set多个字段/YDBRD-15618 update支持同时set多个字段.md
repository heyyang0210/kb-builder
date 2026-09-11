Created by 徐伟, last modified on 七月 17, 2024

  [1. Overview（概述）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#1-overview%E6%A6%82%E8%BF%B0)  

当前yasdb不支持update同时set多个字段的语法，YDBRD-15618支持update同时set多个字段语法，支持的语法形式如下：

**以下支持的语法不报错当前update set expr里面是单列的形式，只包括本次SR增加的支持语法**

**单表**  ：set expr可以是子查询或者values，但是同一个set expr不能子查询和values都有（default表达式与values同类，所以default表达式和子查询不能在一个set expr里面）。   **备注：oracle 只支持set expr是子查询，不能是values**

  


**多表：**  需要打开mysql开关alter system set sql_plugin = 'MYSQL' scope = memory;

|set expr|单表YD|多表|
|---|---|---|
|子查询|update t1 set (c1,c2) = (select 1,2 from dual);|update t1,t2 set (t1.c1, t1.c2) = (select 1,2 from dual), t2.c1 = (select 2 from dual);|
|values|update t1 set (c1,c2) = (2, 3), (c3, c4) = (1, 2);|update t1,t2 set (t1.c1, t1.c2) = (2, 3), t2.c1 = (4);|
||update t1 set (c1) = 3;|update t1, t2 set (t1.c1) = 3, (t2.c1) = 4;|
|  
|update t1 set (c1,c2) = (select 1,2 from dual)，(c3, c4) = (2, 3);|update t1,t2 set (t1.c1, t1.c2) = (select 1,2 from dual), t2.c1 = (4);|
|default|update t1 set (c1,c2) = default;|update t1,t2 set (t1.c1, t1.c2) = default, t2.c1 = (4);|
||update t1 set (c1,c2) = (default, 3);|update t1,t2 set (t1.c1, t1.c2) = (default, 4), t2.c1 = (4);|


  


##   [3. Interfaces（接口）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#3-interfaces%E6%8E%A5%E5%8F%A3)  

  


#### 语法形式：

不能set同一个字段多次同一个update语句。

  [4. Limitations（功能限制）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#4-limitations%E5%8A%9F%E8%83%BD%E9%99%90%E5%88%B6)  

1. update多列不允许set udt类型
1. 同一个set expr里面只能是同一个表的column， 例如update t1,t2 set (t1.c1, t2.c1)= (select 1,2 from dual);报错
1. 同一个set expr里面，只能是单个子查询或者valuelist， 不能两者同时，例如update t1 set (t1.c1, t1.c2) = (11, (select 1 from sys.dual)) where t1.c1 = 1;报错， update update_tb_multi_cols_001 t1 set (t1.c1, t1.c2) = ((select 1 from sys.dual), (select 2 from sys.dual)) where t1.c1 = 1; 也是报错，这里是valulist（里面不能是子查询）


##   [5. Detail Design（详细设计）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

###   [5.1 Architecture（架构）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#51-architecture%E6%9E%B6%E6%9E%84)  

  


###   [5.2 Data Structures & Flow（数据结构与流程）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#52-data-structures--flow%E6%95%B0%E6%8D%AE%E7%BB%93%E6%9E%84%E4%B8%8E%E6%B5%81%E7%A8%8B)  

```
typedef struct StUpdateTable {
    CodUint16     id;
    CodUint8      unused;
    CodBool       updatePartKey;
    CodUint16     setCols;            //新增
    CodUint16     maxCol;           //新增
    CodUint64     setFlags;
    ObjectArray*  setExprs;          //新增
    ObjectArray*  setExprItems;      //新增
    ObjectArray*  exprArray;    // expr map column id， 有修改
} UpdateTable;
```

  


##   [6. Testcases（自测用例）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#6-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

1.合法语法使用和报错拦截的

2.与分区表结合使用

3.与trigger结合用例

  


##   [7. Workload（工作量）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#7-workload%E5%B7%A5%E4%BD%9C%E9%87%8F)  

*评估代码量KLOC、工作量（人天）。*

##   [8. TODO（遗留问题）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#8-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

*说明本方案遗留的问题或下一步需要解决的问题。*