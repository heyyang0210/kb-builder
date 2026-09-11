Created by 秦湫婷 on 七月 19, 2024

*IR链接：*    [https://pingcode.yasdb.com/ship/ideas/660b743f009f91eb87f2b080](https://pingcode.yasdb.com/ship/ideas/660b743f009f91eb87f2b080)    *?*    
  *#YASHAN-304 集群补齐gv视图*

*SR链接：*    [https://pingcode.yasdb.com/pjm/items/6611a953579a3edb84d863d8](https://pingcode.yasdb.com/pjm/items/6611a953579a3edb84d863d8)    *?*    
  *#YDBRD-25929 补齐gv视图（范围见描述）*

##   [1. 总述](http://cod-conf.sics.com/pages/viewpage.action?pageId=72797254#1-overview%E6%A6%82%E8%BF%B0)  

旧版本下v$开头的视图直接将列定义写在了代码中，在需要访问数据的时候直接进行实时的fetch，这种做法更接近于Oracle的x$表，即fixed_table，这种类型的对象将自身的列定义固化在代码中，在获取数据时根据数据库内相关信息实时生成。

而Oracle的动态视图则是由sql语句实现，此类对象也被称为fixed_view。也就是说，之前yasdb内实现的动态视图更接近于Oracle定义的fixed_table而不是fixed_view。

- fixed table是一种新的表类型，其类似当前版本的dynamic view，当前版本的dynamic view本质上是一种dynamic table。其固定是定义的，数据是动态的，并且fixed table存在一定的约束（    [fixed table](https://conf.yasdb.com/display/YAS/fixed+table)    、    [fixed view](https://conf.yasdb.com/display/YAS/fixed+view)    ）。
- fixed view是真正意义上的dynamic view，概念上dynamic view全称为dynamic performance view – 动态性能视图，其强调的是数据是动态变化的一类性能视图。


在需求       [YDBRD-12300](https://jira.yasdb.com/browse/YDBRD-12300?src=confmacro)    -  集群支持全局动态视图  完成  中，于执行引擎内分离了fixed table和fixed view两个不同的对象，将旧有dynamic_view更换成fixed_table + fixed_view的新框架实现。

本次需求是基于fixed_table + fixed_view的新框架实现和多数gv$视图已经适配新框架，继续补齐未适配的gv$视图。

###   [1.1 需求来源](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#11-%E9%9C%80%E6%B1%82%E6%9D%A5%E6%BA%90)  

需求描述：    
  基于gv$视图新框架，继续补齐未适配的gv$视图。

场 景：    
  可以查询出目前未补齐的gv$视图，并且在共享集群部署模式下为各个实例的数据汇总，在单机、分布式下为当前实例的数据。

|部署场景|v$|dv$|gv$|x$|
|---|---|---|---|---|
|单机|正常输出|仅用于分布式|正常输出|非sys用户无法查询|
|集群|仅输出客户端连接节点数据|无法查询|输出当前集群所有活节点数据|非sys用户无法查询，仅输出当前节点数据|
|分布式|仅输出当前节点数据|查询所有节点数据|无法查询（当前可查，为当前节点数据）|非sys用户无法查询，仅输出当前节点数据|


需求范围：

1. 共享集群
1. 当前未补齐的gv$视图


###   [1.2 调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#12-%E8%B0%83%E7%A0%94%E6%96%87%E6%A1%A3)  

无

###   [1.3 需求分析](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#13-%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|:---|:---|:---|:---|:---|
|功能|补齐gv$视图|基于gv$视图新框架，根据改造流程进行补齐|是|是|
|性能|性能场景1|----|否|否|
|可用性|恢复场景|----|否|否|
|可靠性|故障场景|----|否|否|
|可维可测|gv$视图|可在各个部署模式下观察gv$视图信息|是|是|
|安全|安全场景1|----|否|否|
|易用性|----|----|否|否|
|可修改性|----|----|否|否|
|兼容性|----|----|否|否|
|周边配合|权限|----|----|否|
|周边配合|审计|----|----|否|
|周边配合|导入导出工具|----|----|否|


###   [1.4 数据字典](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#14-%E6%95%B0%E6%8D%AE%E5%AD%97%E5%85%B8)  

无

###   [1.5 开源依赖](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#15-%E5%BC%80%E6%BA%90%E4%BE%9D%E8%B5%96)  

无

##   [2. 接口](http://cod-conf.sics.com/pages/viewpage.action?pageId=72797254#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

需要补齐的gv$视图：

|视图名称|介绍|备注|
|---|---|---|
|GV$TABLE_STATISTICS_CACHE|本视图显示字典缓存上表的统计信息内容 。|  
|
|GV$INDEX_STATISTICS_CACHE|本视图显示字典缓存上索引的统计信息内容 。|  
|
|GV$COLUMN_STATISTICS_CACHE|本视图显示字典缓存上列的统计信息内容 。|  
|
|GV$SESS_TIME_MODEL|本视图显示各种操作的会话累积时间。|  
|
|GV$INSTANCE_RECOVERY|本视图显示最近一次实例恢复任务的信息。|  
|
|GV$RECOVERY_STATUS|本视图显示日志回放状态的信息。|  
|
|GV$ARCHIVE_GAP|本视图显示归档gap区间。|  
|
|GV$REPLICATION_STATUS|本视图显示集群中所有节点的备机redo传输汇总信息。|  
|
|GV$SEGMENTS|本视图显示所有已经分配的segment信息。|  
|
|GV$TABLESPACE|本视图显示所有表空间的汇总信息。|  
|
|GV$CONTROLFILE|本视图显示当前所有控制文件信息。|  
|
|GV$DATATYPE|本视图显示当前系统提供的所有数据类型信息。|  
|
|GV$ERROR_CODE|本视图显示所有错误码的详细信息。|  
|
|GV$FUNCTION|本视图显示当前系统提供的所有内置函数信息|  
|


全部视图当前现状和未来发展详见：    [视图整理 - 秦湫婷 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=150608365)  

##   [3. 规格与约束](http://cod-conf.sics.com/pages/viewpage.action?pageId=72797254#3-interfaces%E6%8E%A5%E5%8F%A3)  

无新增约束

##   [4. 特性](http://cod-conf.sics.com/pages/viewpage.action?pageId=72797254#4-limitations%E5%8A%9F%E8%83%BD%E9%99%90%E5%88%B6)  

###   [4.1 gv$视图框架介绍](http://cod-conf.sics.com/pages/viewpage.action?pageId=72797254#51-architecture%E6%9E%B6%E6%9E%84)  

1. x$(fixed table)为动态视图的基表。  动态视图则全部用内置SQL的方式实现。（v$、多数gv$已适配新框架，dv$暂保持旧框架）
1. V$为一个本地执行的query view，SQL引擎可以直接将V$展开并进行优化；GV$为一个带有汇聚属性的全局query view，其相当于在V$的基础上增加了PX汇聚算子。
1. fixed view本身不具备真实对象属性，无法提供权限控制，通过增加dbcr/fixed_views.sql，创建同义词进行权限控制。


![](https://pingcode.yasdb.com/atlas/files/public/67396d4c8970c2af4f5211e2/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDcxNTcsImV4cCI6MTc4MjMxNzk1N30.namvXW9HIx9Cop1ffHkjRPZFCaA43Gz7Y15l3sU-vh4)

*具体gv$视图框架设计详见：*    [支持GV视图框架 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=122076452)  

###   [4.2 改造流程](http://cod-conf.sics.com/pages/viewpage.action?pageId=72797254#52-data-structures--flow%E6%95%B0%E6%8D%AE%E7%BB%93%E6%9E%84%E4%B8%8E%E6%B5%81%E7%A8%8B)  

参考流程：    [动态视图新框架迁移指导 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=127646968)  

参考MR：    [https://git.yasdb.com/cod-x/anchorbase/-/merge_requests/24871](https://git.yasdb.com/cod-x/anchorbase/-/merge_requests/24871)  

##   [5. Testcases（自测用例）](http://cod-conf.sics.com/pages/viewpage.action?pageId=72797254#6-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

*设计开发人员自测用例（文字描述）。*

|部署模式|测试场景|预期|备注|
|---|---|---|---|
|单机、分布式|查询本特性待补齐的gv$视图|结果为客户端连接节点的数据|  
|
|共享集群|查询本特性待补齐的gv$视图|结果为  当前集群所有活节点数据|  
|


##   [6. 资料设计章节](http://cod-conf.sics.com/pages/viewpage.action?pageId=72797254#7-document%E8%B5%84%E6%96%99)  

doc/产品文档/参考手册/系统视图/动态视图目录下增加补齐的gv$视图。

##   [7. 未来规划](http://cod-conf.sics.com/pages/viewpage.action?pageId=72797254#9-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

dv$视图将通过如下需求适配新框架：

  [https://pingcode.yasdb.com/pjm/items/6611601e579a3edb84d6c335](https://pingcode.yasdb.com/pjm/items/6611601e579a3edb84d6c335)    ?    
  #YDBRD-19974 新框架分布式dv适配    


## Attachments: