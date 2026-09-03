Created by 徐伟 on 一月 18, 2024

  [1. Overview（概述）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#1-overview%E6%A6%82%E8%BF%B0)  

本SR两个主要功能点：

1）AnlDataset结构体删除及依赖AnlDatset结构体代码的重构以移除对AnlDatset的依赖。对应于本SR下的如下三个AR。

  [[YDBRD-11764] 【单机】dataset删除rownum，增加count stop key - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-11764)  

  [[YDBRD-11766] 【单机】DML删除dataset - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-11766)  

  [[YDBRD-11767] 【单机】子查询和select创建投影 - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-11767)  

2）CBO支持Insert returning， insert duplicate重构

  [[YDBRD-11789] 【单机】CBO支持Insert returning， insert duplicate - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-11789)  

该AR仅接管原RBO功能，不应该影响任何原有returng与duplicate key update功能

##   [3. Interfaces（接口）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#3-interfaces%E6%8E%A5%E5%8F%A3)  

  


  


  [4. Limitations（功能限制）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#4-limitations%E5%8A%9F%E8%83%BD%E9%99%90%E5%88%B6)  

1. connect by的start with带的filter中出现rownum报错


##   [5. Detail Design（详细设计）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

当前AnlDataset结构体具体如下，

```
typedef struct StAnlDataset {
    PlanDataset*    planDs;
    CodUint64       rownum;
    CodBool         isEof;
    CodBool         isReady;
    CodUint8        unused[6];
    CodUint64       rownumCeil;
    CbyInfo*        cbyInfo;
} AnlDataset;
```

本SR功能点1）需要将该结构体及依赖该结构体代码重构，涉及的主要修改点如下：

1）当前依赖AnlDataset的planDs部分，改为通过传参形式或者将所依赖的planDs上的字段挂在本层的plan上面以解除依赖

2）当前对rownum的实现在执行是通过ds上面的rownum，本次改为通过COUNT plan实现，COUNT plan之前优化已经实现，本次主要是执行改为使用count plan实现rownum以及增加count stop key

rownum可参考    [ROWNUM设计文档 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=91776961)  

3）cbyInfo移除，内部实现改动，之前对于connect by相关  SYSVAR_CBY_ISCYCLE， SYSVAR_CBY_ISLEAF， SYSVAR_CBY_LEVEL的计算是通过拿到ds上面的cbyInfo然后再取值，现在改为通过connect by

的execResources拿到cbyInfo然后再取值。

4）预执行部分(sequence)的改动，之前预执行部分代码调用比较分散，通过判断当前plan是不是最顶层算子来执行预执行，现在改为手动在最顶层算子调用，如sendrow(最顶层select)和DML的顶层。

###   [5.1 Architecture（架构）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#51-architecture%E6%9E%B6%E6%9E%84)  

  


###   [5.2 Data Structures & Flow（数据结构与流程）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#52-data-structures--flow%E6%95%B0%E6%8D%AE%E7%BB%93%E6%9E%84%E4%B8%8E%E6%B5%81%E7%A8%8B)  

  


##   [6. Testcases（自测用例）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#6-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

1.现有用例覆盖

2.sequence

3.rownum

##   [7. Workload（工作量）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#7-workload%E5%B7%A5%E4%BD%9C%E9%87%8F)  

*评估代码量KLOC、工作量（人天）。*

##   [8. TODO（遗留问题）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#8-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

*说明本方案遗留的问题或下一步需要解决的问题。*