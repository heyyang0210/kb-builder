Created by 同二鹏, last modified on 十二月 28, 2023

## 1. Overview（概述）

集群形态部署下，每个DB实例均为对等状态，承载部分全局资源，所有DB实例共享数据库，通过共享缓存模块完成业务的并发控制。如果部分DB实例异常关闭，导致整个DB集群处于不一致状态，包括数据库物理页面的不一致，共享缓存状态的不一致。YCS检测到部分DB异常关闭时，通过更新其他DB实例的拓扑状态，使得MASTER DB感知到其他DB实例的异常，MASTER DB实例需要触发故障的在线恢复，修正前述的不一致问题，让整个DB集群处于正常提供全量服务的状态。

## 2. Features（功能特性）

某DB实例故障后，MASTER DB实例会触发故障在线恢复，无需人工参与，DB集群内部  修正不一致问题，让整个DB集群处于正常提供全量服务的状态。

## 3. Interfaces（接口）

无

## 4. Limitations（功能限制）

1.暂只支持两实例部署的在线恢复处理

2.集群DB故障在线恢复期间，涉及GRC访问的业务会卡住重试，直至对应的GRC资源已经处于正确状态。

3.暂不支持二次故障，二次故障指DB在线恢复期间再次发生实例故障

4.如果实例未处于open状态，实例被切换为主，自己abort

## 5. Detail Design（详细设计）

### 1. DB故障场景梳理

    1). 故障实例非主实例

- 故障实例未加入DB集群，主实例不需要触发在线恢复
- 故障实例已加入DB集群，主实例触发在线恢复
- 故障实例已退出DB集群，主实例不需要触发在线恢复


    2). 故障实例为主实例

- 没有其他活跃实例，不需要触发在线恢复，通过重启恢复数据库一致性
- 存在其他活跃实例，YCS重新选择主实例    

    - 新主实例状态未达到OPEN，自身ABORT，YCS再次选择主实例，直到新主实例是OPEN状态
    - 新主实例状态达到OPEN，触发在线恢复


### 2.总体设计

![](https://pingcode.yasdb.com/atlas/files/public/67396b48a1ad9a3311dc81cd/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTI2NTksImV4cCI6MTc4MjMwMzQ1OX0.vXuJYG6pB62SFYqcJRwaVLwSNflB61EDUxwB3AIcYqk)

### 3.关键流程

    1). db master实例通过topo map信息，触发故障在线恢复

    2). db master实例广播所有实例锁定GRC，不允许访问GRC资源

    3). db master实例执行GRC资源重分布，之后各实例并发重建GRC资源，详见    [GRC资源重分布与恢复 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=119554067)  

    4). db master实例进行故障实例日志预分析，识别需要恢复的物理日志及逻辑日志，将需要重演的物理日志涉及的页面资源的grc resource标记recovery状态。

    5). db master实例广播所有实例本地锁住swap、temp表空间的extent lock，防止业务修改表空间

    6). db master实例广播所有实例解锁GRC

    7). db master实例执行物理日志和控制日志的在线回放。详见    [集群reform在线回放 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=119551130)  

    8). db master实例执行逻辑日志的在线回放，详见    [集群DB支持DDL在线恢复 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=119557942)  

    9). temp/swap表空间的在线恢复，详见    [temp/swap表空间集群故障恢复 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=119558493)  

    10). 启动事务后台回滚

以上流程点不严格按照所列顺序执行，2、3可以并行执行，或者3先执行，2、4并行。5、6可以并行。10可以在6之后任何阶段执行。

## 6. Testcases（用例）

## 7. Workload（工作量）

1. 评估代码量KLOC = xxx行
1. 评估工作量 =xxx（人天）


## 8. TODO（遗留问题）



  


## Attachments:

## Comments:

|  [](null)  ,1. 逻辑日志的版本号
1. 逻辑日志回放时机
1. 逻辑日志是否需要补充
1. 在线恢复期间DDL如何处理
,Posted by zhangrui at 七月 17, 2023 18:33|
|---|
|  [](null)  ,约束：不支持HA部署,Posted by zhangrui at 七月 17, 2023 18:42|
|  [](null)  ,grc并行恢复,Posted by tongerpeng at 七月 18, 2023 17:50|
|  [](null)  ,1. instance recovery要处理二次故障
1. 集群io失败，abort
1. rcyReplayGroupsReformPhase1挪到cluster
1. attr->axcCallbacks.axcReqRecoverBlock     
  attr→axcCallbacks.axcLatchRecoverBlock删除
1. axcReqRecoverBlock 检测二次故障
,Posted by zhangrui at 八月 09, 2023 16:19|
