Created by 张旭涛, last modified on 十一月 15, 2024

  




* IR链接：*  [https://pingcode.yasdb.com/ship/ideas/66d98ebc89f961f33010b187](https://pingcode.yasdb.com/ship/ideas/66d98ebc89f961f33010b187)  *?*    
  *#YASHAN-3294 备集群支持备份*

*SR链接：*  [https://pingcode.yasdb.com/pjm/items/6707483ee489dd0868f383c8](https://pingcode.yasdb.com/pjm/items/6707483ee489dd0868f383c8)  *?*    
  *#YDBRD-33780 备集群支持备份*

##   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=141579921#1-%E6%80%BB%E8%BF%B0)  

  [https://pingcode.yasdb.com/pjm/items/6707483ee489dd0868f383c8](https://pingcode.yasdb.com/pjm/items/6707483ee489dd0868f383c8)  ?  
#YDBRD-33780 备集群支持备份

###   [1.1 需求来源](https://conf.yasdb.com/pages/viewpage.action?pageId=141579921#11-%E9%9C%80%E6%B1%82%E6%9D%A5%E6%BA%90)  

内部需求。

###   [1.2 调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=141579921#12-%E8%B0%83%E7%A0%94%E6%96%87%E6%A1%A3)  

无调研文档。

###   [1.3 需求分析](https://conf.yasdb.com/pages/viewpage.action?pageId=141579921#13-%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  

  


备集群备份子功能

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|:---|:---|:---|:---|:---|
|功能|全量备份|1. 备份压缩、备份加密
1. yasrman远程备份
|是|是|
|功能|增量备份||是|是|
|功能|归档备份||是|是|


###   [1.4 数据字典](https://conf.yasdb.com/pages/viewpage.action?pageId=141579921#14-%E6%95%B0%E6%8D%AE%E5%AD%97%E5%85%B8)  

**无，与单机备机备份规格保持完全一致**

###   [1.5 开源依赖](https://conf.yasdb.com/pages/viewpage.action?pageId=141579921#15-%E5%BC%80%E6%BA%90%E4%BE%9D%E8%B5%96)  

无依赖

##   [2. 接口](https://conf.yasdb.com/pages/viewpage.action?pageId=141579921#2-%E6%8E%A5%E5%8F%A3)  

完全继承单机模式备机的备份语法和命令。



|操作|链接|  
|  
|
|---|---|---|---|
|数据库备份|  [BACKUP DATABASE | YashanDB Doc](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/SQL%E8%AF%AD%E5%8F%A5/BACKUP%20DATABASE.html)  |![](https://pingcode.yasdb.com/atlas/files/public/6739bd628970c2af4f530f62/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFJQUFnQUVBQ0FBQUFnQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTY3MDMsImV4cCI6MTc4MjQ2NzUwM30.s3k_s83DRK7fUre2yqUozPow60m1m86ilFP-P63qPvU)|  
|
|归档备份|  [BACKUP ARCHIVELOG | YashanDB Doc](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/SQL%E8%AF%AD%E5%8F%A5/BACKUP%20ARCHIVELOG.html)  |![](https://pingcode.yasdb.com/atlas/files/public/6739bd62a1ad9a3311dd8db6/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFJQUFnQUVBQ0FBQUFnQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTY3MDMsImV4cCI6MTc4MjQ2NzUwM30.s3k_s83DRK7fUre2yqUozPow60m1m86ilFP-P63qPvU)|  
|


  


  


##   [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=141579921#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  



1. 保证备机可用，连接正常，处于OPEN状态。
1. 所有备集群的备份操作均只能在OPEN节点上执行。
1. 主集群发生REFORM对备集群无影响，只要保证主备集群正常连接，且未发生switchover或者failover。






##   [4. 特性](https://conf.yasdb.com/pages/viewpage.action?pageId=141579921#4-%E7%89%B9%E6%80%A7)  

###   [4.1 特性设计](https://conf.yasdb.com/pages/viewpage.action?pageId=141579921#41-%E7%89%B9%E6%80%A7%E8%AE%BE%E8%AE%A1)  

主备集群的REDO文件个数和名称保持完全一致，获取rcybegin点和flushpoint点。不需要切REDO文件。将REDO文件备份成REDO备份类型。  这些均与单机的备机备份完全一致。  


#### 4.1.1 获取RCYBEGIN点。

1. 主集群：通过广播 消息来获取其他节点的RCYBEGIN点。
1. 备集群：因为备集群只OPEN MASTER节点，其他实例均为nomount或者未拉起状态。所以备集群的RCYBEGIN点可以直接从CTRL文件中获取。




#### 4.1.2 备份CTRL、数据文件

1. 主备集群操作均一致。




#### 4.1.3 获取RCYEND点

1. 主集群：通过广播消息对所有实例加REDOFLUSH锁，加锁成功之后反馈给执行备份实例，再通过广播消息获取所有实例的RCYEND点。
1. 备集群：因为备集群只OPEN MASTER节点，其他实例均为nomount或者未拉起状态。只需要对本节点加REDO FLUSH锁，且不需要广播消息获取RCYEND点，直接从CTRL文件中获取即可。




#### 4.1.4 REDO文件备份

1. 主集群： 主集群备份REDO文件需要先执行切REDO操作，且死等目标ASN的redo文件转为归档。如果REDO文件实际文件大小等于blocksize* lastblockid 则备份为归档，否则备份为REDO类型。
1. 备集群： 备集群备份不需要切REDO操作，按照flushpoint点记录的ASN获取目标归档文件，如果归档文件存在，则备份归档。如果归档不存在就LATCH目标REDO文件， 如果目标ASN的redo是current就备份为redo类型，否则就按照实际使用大小备份为归档（已经自动切REDO，待生成归档）。处理逻辑和单机的备库备份逻辑一致。






###   [4.2 特性功能点2](https://conf.yasdb.com/pages/viewpage.action?pageId=141579921#42-%E7%89%B9%E6%80%A7%E5%8A%9F%E8%83%BD%E7%82%B92)  

#### 4.2.1 归档备份

归档备份，主集群和备集群表现完全一致。  

详细内容参考：   [https://pingcode.yasdb.com/wiki/pages/67396c80728206efb92f1343](https://pingcode.yasdb.com/wiki/pages/67396c80728206efb92f1343)  



#### 4.2.2 备份压缩、加密

备份操作的压缩和加密属性与单机和主集群的操作完全一致。



### 5 安全性

本次修改仅包括备库上执行备份的策略，没有新增命令，备份文件读写机制没有发生变化，不涉及身份验证、授权、访问控制、加密机制和审计机制等安全功能的调整，安全攻击面未变化，不存在被仿冒、篡改、否认、信息泄露、拒绝服务、权限提升等风险。经评估，本次改动无新增安全风险。



  
