Created by 马志宏, last modified by  朱国旭 on 十月 14, 2024

  


#   [YDBRD-20927 : 集群备份恢复支持PITR方案设计](#ydbrd-20927--集群备份恢复支持pitr方案设计)  

IR链接：    [https://jira.yasdb.com/browse/YDBRD-20927](https://jira.yasdb.com/browse/YDBRD-20927)      
  （补丁版本同步IR     [https://jira.yasdb.com/browse/YDBRD-20463）](https://jira.yasdb.com/browse/YDBRD-20463%EF%BC%89)  

##   [1. Overview（概述）](#1-overview概述)  

需求来自华润测试，有集群PITR测试场景。PITR指基于时间点的恢复，先使用备份集恢复到较早的时间点，然后回放归档到目标时间点，以实现将数据库状态回退到期望的时间点状态。通常PITR用于误操作，或者数据库严重损坏，没有其他快速修复手段的情况下，进行数据库的修复。单机已经支持基于SQL的PITR，不支持yasboot的PITR。本次IR将支持集群基于SQL的PITR和基于yasboot的PITR，并新增单机的yasboot PITR。

##   [2. Features（功能特性）](#2-features功能特性)  

通过yasboot下发PITR恢复指令，指令中包含的参数有：备份集路径或tag，指定的时间点（或scn），并行度参数等。yasboot去调用yasrman的PITR，完成数据库PITR恢复。yasrman的普通restore功能，会在restore后，自动open和build备库。yasrman PITR也同样open和build备库。

![](https://pingcode.yasdb.com/atlas/files/public/67396b6d8970c2af4f52048d/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUVBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBS0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFJQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTQwNTksImV4cCI6MTc4MjMwNDg1OX0.K8vDRtgGTVluul4KPG86BeuF2pMQCpprEEYjKU6Y7Po)

SR列表

|SR|功能|设计表现|设计说明|
|---|---|---|---|
|YDBRD-21629|集群内核支持PITR|支持ALTER DATABASE RECOVER UNTIL语法，将集群恢复到指定时间点（SCN），以及yasrman的PITR|集群内核支持回放多实例redo到同一时间点，保证集群数据库一致性。|
|YDBRD-21630|集群OM适配PITR|指定备份集和时间点后，yasboot可以端到端进行PITR恢复|对内核PITR接口封装，包括残留文件清理（保留归档），nomount集群/单机，调用yasrman的PITR。|


##   [3. Interfaces（接口）](#3-interfaces接口)  

具体见YDBRD-21630的设计文档。

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

1. 从备份结束时间到指定TIME或SCN的归档日志都在。
1. 当归档不足，某个实例无法到达指定的TIME或SCN，则会报错（但是TIME允许有1秒的误差，即恢复到的时间比预期最多小1秒）。
1. 需要回放的归档，resetid需要和备份集reset id相同，否则restore阶段无法注册不同reset id的归档。
1. 不同的实例，由于redo之间有相互依赖，无法保证所有实例回放结束时间或SCN完全一致，但是所以实例的回放SCN不会小于指定SCN（TIME模式下，可能有1秒误差）


**结合《特性调研文档》，给出我们与竞品的差异点、优缺点描述。**

##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

####   [关键技术点说明](#关键技术点说明)  

1. 满足redo依赖性的情况下，回放所有实例的归档，直到所有实例回放到指定的SCN，或者某个实例无法继续回放为止。
1. 多个实例的reset point维护需要考虑一致性。
1. yasboot清理数据库的时候，需要保留主库归档，清除备库归档（如果有备库）。


####   [SR列表：](#sr列表)  

|SR|功能|设计表现|文档|
|---|---|---|---|
|YDBRD-21629|集群内核支持PITR|支持ALTER DATABASE RECOVER UNTIL语法，将集群恢复到指定时间点（SCN），以及yasrman的PITR|  [集群内核支持PITR](https://conf.yasdb.com/pages/viewpage.action?pageId=130140584)  |
|YDBRD-21630|集群OM适配PITR|指定备份集和时间点后，yasboot可以端到端进行PITR恢复|  [集群OM适配PITR](https://conf.yasdb.com/pages/viewpage.action?pageId=133578895)  |


###   [5.1 Architecture（架构）](#51-architecture架构)  

![](https://pingcode.yasdb.com/atlas/files/public/67396b6da1ad9a3311dc8306/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUVBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBS0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFJQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTQwNTksImV4cCI6MTc4MjMwNDg1OX0.K8vDRtgGTVluul4KPG86BeuF2pMQCpprEEYjKU6Y7Po)

1. 用户通过yasboot下发PITR
1. yasboot发送请求到yasom，yasom给各实例下发具体指令
1. yasagent调用yasrman，在master实例上进行PITR，然后open master实例
1. yasom open所有实例


###   [5.2 DFX设计](#52-dfx设计)  

按特性的种类可选，涉及安全、性能、可靠、可维、可测；

1.协议、驱动、访问控制、通讯、加密等特性需求，要考虑安全；

2.执行表达式和算子类的特性需求，需要考虑性能；

3.主备、容灾、存储等的特性需求，需要考虑可靠性；

4.所有特性均需要考虑可维、可测。

###   [5.3 其他](#53-其他)  

根据特性开发的种类，有不同的涉及相关项, 如下示例，不同的特性种类关心范围有所差异，需要根据特性种类来扩展：

**涉及数据库语法开发，需要考虑系统权限和系统审计。**

**涉及数据库对象的特性开发，需要考虑对象级权限、对象级审计、对象安全访问和主备同步实现。**

##   [6. TODO（遗留问题）](#6-todo遗留问题)  

*说明本方案遗留的问题或下一步需要解决的问题。*

  


![](https://pingcode.yasdb.com/atlas/files/public/67396b6da1ad9a3311dc8306/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUVBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBS0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFJQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTQwNTksImV4cCI6MTc4MjMwNDg1OX0.K8vDRtgGTVluul4KPG86BeuF2pMQCpprEEYjKU6Y7Po)

![](https://conf.yasdb.com/download/attachments/64817852/image2021-8-12_11-36-1.png?version=1&modificationDate=1628739249000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUVBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBS0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFJQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTQwNTksImV4cCI6MTc4MjMwNDg1OX0.K8vDRtgGTVluul4KPG86BeuF2pMQCpprEEYjKU6Y7Po)

## Attachments: