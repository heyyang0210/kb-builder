Created by 朱国旭, last modified on 四月 23, 2024

*概要设计-YASHAN-170 : 集群支持手动Switchover*

*IR链接：*    [https://pingcode.yasdb.com/ship/ideas/660b743f009f91eb87f2affa](https://pingcode.yasdb.com/ship/ideas/660b743f009f91eb87f2affa)    *?*    
  *#YASHAN-170 【主备集群】集群间支持手动switchover*

##   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=141578191#1-%E6%80%BB%E8%BF%B0)  

根据业务的实际需要，主备集群需要支持集群间手动switchover的能力。

###   [1.1 需求来源](https://conf.yasdb.com/pages/viewpage.action?pageId=141578191#11-%E9%9C%80%E6%B1%82%E6%9D%A5%E6%BA%90)  

需求描述：

内部测试需求：支持集群间支持手动switchover。

场景：

在客户场景测试或者演练过程中，需要进行主备之间的倒换演练。需要主备集群支持集群间支持手动switchover

需求范围：

集群

需求规格：

1. 支持同构集群复制，要求节点数对等，版本相同
1. 1号实例switchover成功后，其他备实例需要手动open


交付版本：

23.2.x

###   [1.2 调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=141578191#12-%E8%B0%83%E7%A0%94%E6%96%87%E6%A1%A3)  

同友商实现方式有差异，功能依赖现有规格和单机的实现功能对齐。

###   [1.3 需求分析](https://conf.yasdb.com/pages/viewpage.action?pageId=141578191#13-%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  

|属性|场景名称|方案设计|关键技术点|特性是否涉及|SR|
|:---|:---|:---|:---|:---|:---|
|功能|主备切换的能力|执行alter database switchover操作实现。（当前SR实现）|是|是|  [https://pingcode.yasdb.com/pjm/items/66191dcafd997db58ad89fec](https://pingcode.yasdb.com/pjm/items/66191dcafd997db58ad89fec)    ?    
  #YDBRD-26294 【主备集群】集群间支持手动switchover|
|周边配合|权限|同单机权限保持一致|否|否|  
|


###   [1.4 数据字典](https://conf.yasdb.com/pages/viewpage.action?pageId=141578191#14-%E6%95%B0%E6%8D%AE%E5%AD%97%E5%85%B8)  

无

  [1.5 开源依赖](https://conf.yasdb.com/pages/viewpage.action?pageId=141578191#15-%E5%BC%80%E6%BA%90%E4%BE%9D%E8%B5%96)  

无

##   [2. 接口](https://conf.yasdb.com/pages/viewpage.action?pageId=141578191#2-%E6%8E%A5%E5%8F%A3)  

|接口|接口表现|接口说明|是否涉及|
|:---|:---|:---|:---|
|SQL语法|alter database switchover|主备角色在线切换|是|
|动态视图|v$database的  SWITCHOVER_STATUS|主备角色切换的状态|是|
|动态视图|v$REPLICATION_STATUS|主备连接状态|是|
|错误码|错误码、ACTION描述|----|是|


##   [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=141578191#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

**备集群**

1. 备集群只能是1号实例执行switchover，并且是处于open阶段。
1. 备集群的所有实例的redo传输必须是正常的（连接正常并且状态也是正常）。


**主集群**

1. 主集群的1号实例必须open。
1. 其他存活实例的状态必须是open状态，不能出现nomount状态或者是mount状态。


##   [4. 特性](https://conf.yasdb.com/pages/viewpage.action?pageId=141578191#4-%E7%89%B9%E6%80%A7)  

###   [4.1 整体实现流程](https://conf.yasdb.com/pages/viewpage.action?pageId=141578191#41-%E7%89%B9%E6%80%A7%E5%8A%9F%E8%83%BD%E7%82%B91)  

1. *主备集群正常建立连接，传输redo日志。*
1. *备集群连接主集群的1号实例执行降备操作。*
1. *主集群1号实例广播消息让其他实例执行降备操作。*
1. *主集群的所有业务会话断连。*
1. *备集群完全同步主集群后，主集群重启其他实例到nomount阶段，1号实例修改角色为Standby。备机开始升主，修改角色为Primary。*
1. *新主集群开始提供业务。*
1. open新主集群的1其他实例。


![](https://pingcode.yasdb.com/atlas/files/public/67396cdca1ad9a3311dc8d30/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDM5ODAsImV4cCI6MTc4MjMxNDc4MH0.VR729Y_jMLizTRUDNDvRgab_cAdU76DbXzJHJff9skU)

##   [5.未来规划](https://conf.yasdb.com/pages/viewpage.action?pageId=141578191#5%E6%9C%AA%E6%9D%A5%E8%A7%84%E5%88%92)  

1. 备集群可以连接主集群的master实例做switchover操作。
1. 备集群的其他实例可以open。
1. 主集群降备过程中无需关闭其他实例。


## Attachments: