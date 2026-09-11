Created by 罗爽, last modified on 四月 16, 2024

# **1 概述**

23.2问题单转需求。

问题单：    [YDBRD-28869](https://jira.yasdb.com/browse/YDBRD-28869?src=confmacro)    -  【质量加固】【扩缩容】扩缩容时需拦截alter system  解决关闭

IR：    [YDBRD-29238](https://jira.yasdb.com/browse/YDBRD-29238?src=confmacro)    -  【CCB转需求】分布式扩容节点增加中间状态  设计中

SR：    [YDBRD-29777](https://jira.yasdb.com/browse/YDBRD-29777?src=confmacro)    -  CN扩容流程适配新的流程  待启动

开发设计文档：    [CN扩容CM新增扩容状态设计方案](147760767.html)  

相关文档：    [关于CN扩缩容问题：集群管理状态迁移问题](https://conf.yasdb.com/pages/viewpage.action?pageId=147761555)  

# **2 需求分析**

对于新的CN扩容流程，增加节点中间状态，  处于中间状态的节点，查询视图不可见；只有扩容流程完成后，节点才可见。具体实现为  OM先添加CM新CN位扩容状态，添加成功后建库拉取到 FULL_ASYNC 状态，等元数据迁移完成后，通过子任务修改扩容CN节点到 NORMAL 状态，调用CM同步通知接口，通知成功后再放开DDL Lock。

## 2.1 功能点分析

扩容过程中执行ddl、dcl的预期如下：

- DDL - 执行失败，存在DDL LOCK
- DCL  -    ALTER_SYS_SET执行失败，其他执行成功
- dv视图 - 正常查询


扩容完成后执行ddl、dcl成功。

【注】：dml已有用例看护。

## 2.2 规格约束

1.CN扩容失败，需要调用OM clean命令清理新CN节点才能继续扩容。

   -- 扩容任务更改状态子任务执行前失败（场景：元数据迁移失败），扩容任务报失败，并且解锁DDL LOCK。   // 自动解锁ddl lock, 需要手动clean

   --  扩容任务更改状态子任务执行失败（场景：元数据迁移成功，状态更新子任务失败），扩容任务报失败，不解锁DDL LOCK, DDL LOCK通过OM clean命令清理。--需要补充资料，影响ddl dcl,补充解决方案

2.  发起CN扩容，执行DCL设置系统参数可能会导致扩容节点参数不一致                     // alter session修改

## 2.3 相关视图

v$cm_node_info  -    CM模块存储的NODE INFO信息列表。

dv$task  -    分布式集群中所有节点上执行和等待的任务信息。

dv$instance 

dv$node 

视图查询结果如下：

1. 扩容完成前，1）直连新增节点查v$node可以查到中间状态，查dv$node可以查到本节点和其他节点信息；2）  直连旧CN节点查dv$node查不到新增节点信息。
1. 扩容完成后，新增CN节点和旧CN节点可以查到所有节点信息。


# **3**     **测试设计方法**   

## 3.1 测试设计方法

本次测试主要采用场景法、正交组合法、等价类进行测试。

## 3.2 详细测试设计

1）扩容的CN节点数量：[1, 8-n]  (n为已有cn节点个数)

     新CN节点分布：已有主机、新主机

【注】  ：已有用例看护。

2）SQL类型

|类型I|类型II|说明|
|---|---|---|
|DDL|create|拦截,  
,ddl对象  关注database, system  ，其他对象如table、view、index等已有用例看护|
||alter||
||drop||
||truncate 已有用例看护||
||rename 已有用例看护||
||comment 已有用例看护||
|DCL    
    
    
    
    
    
    
    
    
,  
,  
|ALTER_SYS_SET|拦截|
||ALTER_SYS_KILL（kill session）|正常执行|
||ALTER_SYS_CANCEL（cancel sql）||
||ALTER_SYS_CLEAN_RESIDUAL_SPACE,(清理残留表空间)||
||ALTER_SYS_FLUSH_GTS|正常执行|
||alter session|正常执行,  
|
||commit/rollback||
||grant/revoke||
||savepoint/(release savepoint)||
||set transaction 不支持||


3）相关配置参数

DDL_LOCK_TIMEOUT=0，可能导致扩容失败。

## 3.3 DFX测试

|系统级DFX分类|是否涉及|说明|
|:---|:---|---|
|CT 并发测试|是|ddl + cn扩缩容 - 预期扩缩容成功,dcl + cn扩缩容 - 预期扩缩容成功 |
|DFR|/|  
|
|HA|是|mn主备切换，预期扩容任务失败|
|KT kill测试|是|扩容之前节点异常,kill mn主节点 - 扩容失败,kill mn备节点 - 扩容失败,kill old cn  - 扩容失败,kill new cn  - 扩容失败,kill dn - 不影响|
|一致性|是|反复执行CN扩缩容,1）扩容成功-缩容-再次扩容,2）扩容失败-缩容-再次扩容|
|三方测试工具    
  (sqltest，sqlancer)|/|  
|
|压力|/|  
|
|可维护性|/|  
|
|安全|/|  
|
|性能|/|  
|
|长稳|/|  
|


[YDBRD-29777 CN扩容新流程.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjYjY4OTcwYzJhZjRmNTIwZTA1IiwicmVmX2lkIjoiNjczOTZjYjY1OTNmOTljOWZmMjM3MjQ3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAyODY0LCJleHAiOjE3ODIzODkyNjR9.72SXGezX3h1nog0tkGBAe9M9ZFBC1fg2-NvkyhTCT0g)

# **4 测试用例**

# **5 测试框架设计**

本次测试使用guider框架，一致性框架、testkill框架和ha框架  实现。

# **6 测试环境说明**

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|分布式1mn2cn2dn，mn为一主两备|


## Attachments:

[YDBRD-29777 CN扩容新流程.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjYjY4OTcwYzJhZjRmNTIwZTA1IiwicmVmX2lkIjoiNjczOTZjYjY1OTNmOTljOWZmMjM3MjQ3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAyODY0LCJleHAiOjE3ODIzODkyNjR9.72SXGezX3h1nog0tkGBAe9M9ZFBC1fg2-NvkyhTCT0g)

 (application/x-xmind)    


## Comments:

|  [](null)  ,2024/04/09会议纪要    
  1.dml已有用例看护，不用测    
  2.本SR不涉及dn节点，不用测    
  3.ddl重点关注database，system相关    
  4.补充DDL_LOCK_TIMEOUT=0测试    
  5.扩容任务更改状态子任务执行失败，导致扩容任务报失败，1）需要补充资料说明2）不解锁DDL LOCK，影响ddl dcl执行,补充解决方案。,Posted by luoshuang at 四月 10, 2024 10:12|
|---|
