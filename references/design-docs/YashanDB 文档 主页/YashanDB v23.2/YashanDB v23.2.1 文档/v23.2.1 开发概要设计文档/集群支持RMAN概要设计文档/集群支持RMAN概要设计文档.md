Created by 张旭涛, last modified by  瞿蓝孟 on 一月 17, 2024

#   [YDBRD-21614 : yasrman工具支持集群](https://conf.yasdb.com/pages/viewpage.action?pageId=138546096#ydbrd-21614--yasrman%E5%B7%A5%E5%85%B7%E6%94%AF%E6%8C%81%E9%9B%86%E7%BE%A4)  

IR链接：    [[YDBRD-20221] 支持yasrman备份与备份集管理 - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-20221)  

##   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#1-%E6%80%BB%E8%BF%B0)  

yasrman目前只支持单机和分布式，需要yasrman支持集群备份恢复、备份集管理，使3种部署形态下的yasrman行为统一。

###   [1.1 需求来源](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#11-%E9%9C%80%E6%B1%82%E6%9D%A5%E6%BA%90)  

在单机和分布式上，OM目前调用yasrman去执行备份恢复的命令，而集群目前不支持yasrman，所以OM使用sql命令进行备份和恢复，与单机和分布式行为不一致。

集群需要支持yasrman，  使3种部署形态下的yasrman行为统一。

###   [1.2 调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#12-%E8%B0%83%E7%A0%94%E6%96%87%E6%A1%A3)  

oracle的rman工具既支持单机，也支持RAC集群，且行为上没有太大差异。yasrman对标oracle rman，此外单机和集群的数据都是一份，而不是分布式那样有多个数据库，所以在备份恢复时，yasrman应该在单机和集群上表现基本一致。

###   [1.3 需求分析](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#13-%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  

|属性|场景名称|方案设计|关键技术点|特性是否涉及|SR|wiki|
|:---|:---|:---|:---|:---|:---|---|
|功能|集群内核支持yasrman|将yasrman在集群上拦截的地方放开，同时考虑一下yasrman对YFS文件系统的拦截。|是|是|  [YDBRD-21614](https://jira.yasdb.com/browse/YDBRD-21614?src=confmacro)    -  yasrman工具支持集群  完成|  [集群支持RMAN特性设计文档](141580157.html)  |
|  
|OM适配集群yasrman|1. OM替换在集群备份恢复的SQL语句，保持和单机一样，使用yasrman接口
1. yasbak封装yasrman，yasboot不再支持备份和恢复命令，由yasbak代替
|是|是|  [YDBRD-21615](https://jira.yasdb.com/browse/YDBRD-21615?src=confmacro)    -  OM适配yasrman集群备份恢复  完成|  
|
|可靠性|故障场景|与单机yasrman一致|否|否|----|  
|
|可维可测|DFX功能1|与单机yasrman一致|否|否|----|  
|


###   [1.4 数据字典](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#14-%E6%95%B0%E6%8D%AE%E5%AD%97%E5%85%B8)  

**描述本篇文档中特性的术语集**

|术语|描述|借鉴业界|参考|
|:---|:---|:---|:---|
|yasrman|恢复管理器工具|是|rman|


###   [1.5 开源依赖](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#15-%E5%BC%80%E6%BA%90%E4%BE%9D%E8%B5%96)  

依赖组件描述和开源协议，三方件原理、背景介绍，依赖的原因以及后续演进方案。

##   [2. 接口](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#2-%E6%8E%A5%E5%8F%A3)  

yasrman的接口详见    [YDBRD-21614](https://jira.yasdb.com/browse/YDBRD-21614?src=confmacro)    -  yasrman工具支持集群  完成  。

yasbak的接口：

  


  


  [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

**规格**

1. yasrman支持集群全量备份，增量备份
1. yasrman支持集群远程备份，xbsa流式备份
1. yasrman支持集群PITR
1. yasbak支持调用yasrman


**约束**

1. 恢复必须是master role节点，且必须是nomunt状态。
1. server端可以指定备份路径为普通磁盘和YFS，client端只能指定普通磁盘。
1. 备集群不支持备份恢复


##   [4. 特性](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#4-%E7%89%B9%E6%80%A7)  

![](https://pingcode.yasdb.com/atlas/files/public/67396b6e8970c2af4f520497/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBa0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ1FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTQxMDQsImV4cCI6MTc4MjMwNDkwNH0.5EQc0z6jcFHsVKCzMla2Y_EBGQ8OiCEsz00zWD3H2v8)

###   [4.1 特性功能点1](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#41-%E7%89%B9%E6%80%A7%E5%8A%9F%E8%83%BD%E7%82%B91)    （集群内核支持yasrman）

**备份**

backup database format ‘xxx’ dest server/client

与单机差异： 

DB端的备份既可以指定YFS，也可以指定普通磁盘，远程发送备份集文件复用单机逻辑，format只能指定普通磁盘。

**恢复**

restore database from tag xxx

与单机差异：

与SQL执行restore的约束相同，需要连接master实例。

#### **查看备份集**

list backup

添加单机之外的内容， 比如列出集群实际节点个数。

###   [4.2 特性功能点2](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#42-%E7%89%B9%E6%80%A7%E5%8A%9F%E8%83%BD%E7%82%B92)    （yasbak适配yasrman）

yasbak封装yasramn，支持集群的备份恢复命令；

yasbak命令格式不变，与yasramn保持一致；

###   [4.7 特性周边配合](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#47-%E7%89%B9%E6%80%A7%E5%91%A8%E8%BE%B9%E9%85%8D%E5%90%88)  

**不涉及**

##   [5.未来规划](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#5%E6%9C%AA%E6%9D%A5%E8%A7%84%E5%88%92)  

- yasbak支持调用yasql，去发送某些SQL命令，比如alter database open resetlogs等
- yasbak和yasrman保留一个，用go封装二进制，调用yasrman.so


  


## Attachments:

[image2023-11-15_9-19-1.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiNmVhMWFkOWEzMzExZGM4MzBiIiwicmVmX2lkIjoiNjczOTZiNmU3MjgyMDZlZmI5MmYwNWMxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk0MTA0LCJleHAiOjE3ODIzODA1MDR9.R64CkXxj91jwFDIekhKIKttub6vJxe6jQjHfscxYV8o)

 (image/png)    


[image2023-11-15_9-18-5.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiNmU4OTcwYzJhZjRmNTIwNDk2IiwicmVmX2lkIjoiNjczOTZiNmU3MjgyMDZlZmI5MmYwNWMxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk0MTA0LCJleHAiOjE3ODIzODA1MDR9.xz-URCIj7vEAh8ms1bJbMyKYftaRqcNs-r_RL6el7ns)

 (image/png)    


[image2023-11-15_9-17-30.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiNmVhMWFkOWEzMzExZGM4MzBjIiwicmVmX2lkIjoiNjczOTZiNmU3MjgyMDZlZmI5MmYwNWMxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk0MTA0LCJleHAiOjE3ODIzODA1MDR9.v_IXeB2hCWUIIw_rsqMX2kT9pW2LBmgrhGutjMxHzw4)

 (image/png)    
