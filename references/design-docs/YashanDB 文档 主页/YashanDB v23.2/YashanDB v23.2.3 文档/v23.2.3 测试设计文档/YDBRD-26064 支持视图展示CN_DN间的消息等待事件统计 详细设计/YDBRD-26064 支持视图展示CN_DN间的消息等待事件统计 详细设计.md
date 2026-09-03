Created by 李潮, last modified on 十月 12, 2024

# 1.   **概述**

   本文主要内容为  增加cn/dn间消息交互流程中的等待事件，以增强相关场景下的问题定位能力  的测试设计。

# 2.   **需求分析**

SR:     [https://pingcode.yasdb.com/pjm/items/661690a8fd997db58ad70a67](https://pingcode.yasdb.com/pjm/items/661690a8fd997db58ad70a67)    ?    
  #YDBRD-26064 支持视图展示CN/DN间的消息等待事件统计

设计文档：    [YDBRD-29693 CN/DN 消息等待事件完善 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=150616231)  

概要设计：    [YDBRD-26064 概要设计 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=152996285)  

## 1.等待事件

|类型|事件名|节点|场景|开始|结束|
|---|---|---|---|---|---|
|分布式节点交流统一事件|wait distributed result|cn/其他节点|一般分布式下消息交流的命令字，没有添加具体事件就是这个|发送端发送消息|接收到消息回信|
|cn/dn 建连|cn connecting dstb node|cn|分布式会话，cn/其他节点建连|cn发送建连命令|其他节点处理建连结束，cn收到ack，一次可能同时等待多个节点建连结束|
|  
|dstb node wait cn cmd|dn/mn/cn 包括备机|分布式会话，其他节点建连后轮询等待cn的cmd|建连完成后，没有正在执行的命令字时|有命令正在执行，或者会话结束|
|channel数据传输|tabqueue channel receive data（暂不添加）|cn/dn/ 集群|分布式执行数据传输的网络交互|查询执行中cn接收一次channel发送的数据|接收结束|
|  
|stats channel receive data|cn|收集统计信息channel传输数据|cn接收一次channel发送的msg|接收结束|
|lob|dstb lob data request|cn|分布式lob查询, lob read data时的等待，read length不添加|lob请求端发送请求|接收完lob数据|
|执行|alloc px res(已有)|cn/ 单机|并行资源申请|一次执行的整个资源申请之前|该次执行资源申请结束|
|  
|dstb release px res|cn|并行资源释放|申请资源失败的场景，cn发送释放资源命令字|所有dn完成资源释放并ack|
|  
|dstb dml prepare|cn|执行前prepare|资源申请及plan的序列化等操作结束后，发送prepare命令字等待dn处理|所有dn完成prepare操作并ack|
|  
|dstb dml start|cn|实际执行的命令字|查询语句，prepare结束后cn发送start命令字|所有stage group 执行结束|
|事务|xa prepare|cn|2pc的prepare|cn发送事务prepare给涉及的dn|所有dn 事务prepare完成|
|  
|xa commit|cn|2pc的commit|cn发送事务commit|所有dn commit完成|
|  
|check xa end（已有）|cn|异常场景等待事务结束|事务commit出现异常时，等待事务二阶段提交|dn事务结束后，ack|
|  
|dstb commit|cn|单节点commit|发送相应命令字给dn执行|cn等待所有dn完成相应命令|
|  
|dstb rollback|cn|rollback all/ rollback savepoint/ rollback current|以下同上|  
|
|  
|dstb savepoint|cn|生成新savepoint|  
|  
|
|  
|dstb release savepoint|cn|删除savepoint|  
|  
|
|ddl/dcl|dstb alter system|cn|cn等待其他节点alter system操作|  
|  
|
|  
|dstb alter sesssion|cn|cn等待其他节点的alter session操作|  
|  
|
|  
|dstb execute ddl|cn|cn发送ddl给 mn/dn 等待目标执行结束|  
|  
|
|  
|dstb execute dcl|cn|ddl的事务操作|  
|  
|


## 2.相关视图

|**等待事件视图**|
|---|
|v$system_event,dv$system_event,gv$system_event|
|v$session_wait,gv$session_wait|
|V$SESSION_EVENT|
|v$session,dv$session,gv$session|


3.需求范围：

1. 分布式


       2. 交付版本：23.2.3.100

# 3.   **测试设计方法**

**主要采用的等价类划分，场景法组合进行设计 **

**1.节点间交流**

**（1）发起连接，关闭连接**

**（2）发起连接，故障节点，执行查询**

**（3）发起连接，执行查询**

**（4）发起连接，执行慢sql查询，故障发送端/接收端**

**2.**  **channel数据传输**

**（1）正常收集统计信息**

**（2）故障第一个dn组主节点造成收集失败**

**（3）故障其他cn节点**

**（4）引入网络故障**

**3.lob**

**（1）发起lob查询/更新/插入/删除**

**（2）发起lob查询/插入，故障发送端**

**4.执行**

**（1）执行查询，资源正常**

**（2）执行查询，内存/cpu等资源不足**

**（3）配置并行资源不足**

**5.事务（分单节点与多节点）**

**（1）正常事务，创建savepoint，回滚，释放savepoint，提交**

**（2）正常事务，手动rollback**

**（3）异常事务，dml执行失败，自动rollback current**

**（4）异常事务，业务并发执行，节点故障，自动rollback all**

**（5）正常事务，创建savepoint，提交场景自动释放savepoint**

**（6）正常事务，cn未commit发生故障，mn处理未决事务rollback all**

**6.dcl/ddl**

**（1）修改系统级参数，单节点/多节点/memory/spfile/both**

**（2）修改系统级参数，多节点其他节点故障**

**（3）修改系统级参数，参数不合法**

**（4）修改会话级参数，参数合法/不合法**

**（5）创建/修改/删除 表，索引，视图，函数，存储过程，触发器（合法/非法）**

**（6）上述情况，dn故障**

**（7）用户创建/修改/修改密码（合法/非法）**

**（8）上述情况，dn故障**

**（9）用户授权（合法/非法）**

**（10）上述情况，dn故障**

**7.tpch校验**

  


# 4.   **详细测试设计**

## 1.节点间交流事件

|事件名|说明（开始  ——  结束）|
|---|---|
|wait distributed result|发送端发送消息——接收到消息回信|
|cn connecting dstb node|cn发送建连命令——其他节点处理建连结束，cn收到ack，一次可能同时等待多个节点建连结束|
|dstb node wait cn cmd|建连完成后，没有正在执行的命令字时——有命令正在执行，或者会话结束|


  


|cn connecting dstb node（建连）|视图校验|
|---|---|
|客户端向CN节点发起连接|cn|
|dstb node wait cn cmd（建连完成，等待执行命令）|视图校验（dv$session_event不产生）|
|客户端向CN节点发起连接，等待20s，关闭连接|cn|
|上述场景，执行查询dv$session视图|dn/mn/cn 包括备机|
|上述场景，DN单个主节点异常，执行查询dv$session视图|同上|
|上述场景，MN单个主节点异常，执行查询dv$session视图|同上|
|上述场景，DN单个备节点异常，执行查询dv$session视图|同上|
|上述场景，MN单个备节点异常，执行查询dv$session视图|同上|
|wait distributed result（消息交流，无具体事件）|视图校验|
|客户端向CN节点发起连接cn，执行查询dv$session视图|dn/mn/cn 包括备机|
|上述场景，执行慢SQL，故障DN主节点|cn|
|上述场景，执行慢SQL，故障CN节点|dn|


## 2.  channel数据传输

|事件名|说明（开始  ——  结束）|
|---|---|
|tabqueue channel receive data|查询执行中cn接收一次channel发送的数据——接收结束|
|stats channel receive data|cn接收一次channel发送的msg——接收结束|


|tabqueue channel receive data  （暂不添加）||
|---|---|
|stats channel receive data|视图校验|
|收集统计信息|cn|
|上述场景过程中，故障第一个dn组主节点造成收集失败|cn|
|故障其他cn节点|cn|
|引入网络故障|cn|


## 3.lob

|事件名|说明（开始  ——  结束）|
|---|---|
|dstb lob data request|lob请求端发送请求——接收完lob数据|


|dstb lob data request|视图校验|
|---|---|
|发起lob查询|cn，dn|
|发起lob查询，故障dn节点|cn|
|插入lob数据(废弃）|cn，dn|
|插入lob数据，故障cn节点(废弃）|dn|
|删除lob数据(废弃）|cn，dn|
|更新lob数据(废弃）|cn，dn|


## 4.执行

|事件名|说明（开始  ——  结束）|
|---|---|
|alloc px res(已有)|一次执行的整个资源申请之前——该次执行资源申请结束|
|dstb release px res|申请资源失败的场景，cn发送释放资源命令字——所有dn完成资源释放并ack|
|dstb dml prepare|资源申请及plan的序列化等操作结束后，发送prepare命令字等待dn处理——所有dn完成prepare操作并ack|
|dstb dml start|查询语句，prepare结束后cn发送start命令字——所有stage group 执行结束|


|alloc px res+dstb release px res|视图校验|
|---|---|
|构造  申请资源失败场景（  ~~占满内存~~  /  ~~cpu 100%~~  ），  发起查询语句|cn，单机（  alloc px res  ）|
|配置并行资源不足|  
|
|alloc px res+dstb dml prepare+dstb dml start|视图校验|
|发起dml语句|cn，单机(  alloc px res)|


# 5.  事务

|事件名|说明（开始  ——  结束）|
|---|---|
|xa prepare|cn发送事务prepare给涉及的dn——所有dn 事务prepare完成|
|xa commit|cn发送事务commit——所有dn commit完成（2pc）|
|check xa end（已有）|事务commit出现异常时，等待事务二阶段提交——dn事务结束后，ack（2pc）|
|dstb commit|发送相应命令字给dn执行——cn等待所有dn完成相应命令（单节点）|
|dstb rollback|发送相应命令字给dn执行——cn等待所有dn完成相应命令|
|dstb savepoint|发送相应命令字给dn执行——cn等待所有dn完成相应命令|
|dstb release savepoint|发送相应命令字给dn执行——cn等待所有dn完成相应命令|


|场景|多dn|单dn|
|---|---|---|
|**普通rollback**,开启事务，执行dml，设定保存点1，执行dml，回滚到保存点1，释放保存点1，事务提交|xa prepare+dstb savepoint+dstb rollback+dstb release savepoint+xa commit|dstb savepoint+dstb rollback+dstb release savepoint+dstb commit|
|**rollback all**,开启事务，并发执行业务与dn主节点故障，事务提交|xa prepare+dstb rollback all+xa commit|dstb rollback all+dstb commit|
|**rollback current**,开启事务，执行dml操作失败，例如唯一键冲突，事务提交|xa prepare+dstb rollback current+xa commit|dstb rollback current+dstb commit|
|**commit异常**,开启事务，执行dml，构建dn节点故障，事务提交|xa prepare+dstb rollback all+check xa end|dstb rollback all+dstb commit|
|**commit后自动释放savepoint**,开启事务，执行dml，设定保存点1，事务提交|xa prepare+dstb savepoint+xa commit+dstb release savepoint|dstb savepoint+dstb commit+dstb release savepoint|
|**未commit，cn故障，mn完成未决事务（废弃，cn节点停止后，记录会被清空）**,开启事务，执行dml，设定保存点1，执行dml，故障cn节点|xa prepare+dstb rollback all|dstb rollback all|
|开启自动提交|  
|  
|


# 5.  ddl/dcl

|事件名|说明（开始  ——  结束）|
|---|---|
|dstb alter system|发送相应命令字给dn执行——cn等待所有dn完成相应命令    
|
|dstb alter sesssion|发送相应命令字给dn执行——cn等待所有dn完成相应命令|
|dstb execute ddl|发送相应命令字给dn执行——cn等待所有dn完成相应命令|
|dstb execute dcl|发送相应命令字给dn执行——cn等待所有dn完成相应命令|


|dstb alter system|视图校验|
|---|---|
|修改系统级参数，单节点生效|cn|
|修改系统级参数，全部节点生效|  
|
|上述dn/mn故障|  
|
|修改系统级参数，memory生效|  
|
|修改系统级参数，spfile生效|  
|
|修改系统级参数，both生效|  
|
|修改系统级参数无效值|  
|
|dstb alter sesssion|视图校验|
|修改session级参数，立即生效|cn|
|修改session参数无效值|  
|
|dstb execute ddl|视图校验|
|创建/修改/删除分布表(lsc/tac)/复制表/二级分区（合法，非法）|  
|
|上述dn故障|  
|
|创建/修改/删除合法索引（合法，非法）|  
|
|上述dn故障|  
|
|创建/修改/删除视图（合法，非法）|  
|
|上述dn故障|  
|
|创建/修改/删除函数（合法，非法）(废弃）|  
|
|上述dn故障(废弃）|  
|
|创建/修改/删除存储过程（合法，非法）(废弃）|  
|
|上述dn故障(废弃）|  
|
|创建/修改/删除触发器（合法，非法）(废弃）|  
|
|上述dn故障(废弃）|  
|
|dstb execute dcl|视图校验|
|用户创建/删除|  
|
|上述dn故障|  
|
|上述不合法|  
|
|用户授权/撤销权限|  
|
|上述不合法|  
|
|上述dn故障|  
|
|用户修改密码|  
|
|上述不合法|  
|
|上述dn故障|  
|


# 6.TPCH性能校验

|  
|  
|  
|
|---|---|---|
|  
|  
|  
|
|  
|  
|  
|


# 5.   **测试用例**

**1.冒烟用例**

**2.文本用例**

  


# 6.   **测试框架设计**

1. 如果用例不能实现自动化需要在此标注并说明原因
1. 如果需要使用新的测试框架实现用例的自动化，需要在此说明测试框架的架构逻辑及详细设计
1. 如果沿用已有测试框架，需要在此标注测试框架的路径


  


# 7.   **测试环境说明**

测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等

  


## Attachments:

[image2024-5-8_16-9-42.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZjk4OTcwYzJhZjRmNTIwZjdlIiwicmVmX2lkIjoiNjczOTZjZjk3MjgyMDZlZmI5MmYxOTU5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1MDM0LCJleHAiOjE3ODIzOTE0MzR9.nT88t9QYSG-eHm-UBWAjAygyHLIQ_ax11jaqaIlyKVo)

 (image/png)    


[YDBRD-26064冒烟用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZjlhMWFkOWEzMzExZGM4ZGYxIiwicmVmX2lkIjoiNjczOTZjZjk3MjgyMDZlZmI5MmYxOTU5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1MDM0LCJleHAiOjE3ODIzOTE0MzR9.PysOtw54r6397fe7oegm4mmIjR56P_Lxl1c-d2kB4AY)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[YDBRD-26064文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZjk4OTcwYzJhZjRmNTIwZjdmIiwicmVmX2lkIjoiNjczOTZjZjk3MjgyMDZlZmI5MmYxOTU5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1MDM0LCJleHAiOjE3ODIzOTE0MzR9.hjs6XnJ3DE-6HkBBJ29PjEc3wBJ-JNrqV50syN_pxAI)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[image2024-5-10_11-47-19.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZjk4OTcwYzJhZjRmNTIwZjgwIiwicmVmX2lkIjoiNjczOTZjZjk3MjgyMDZlZmI5MmYxOTU5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1MDM0LCJleHAiOjE3ODIzOTE0MzR9.6mCuaMbkyj_U7nBqI3ZWRpUWHfUfOdhNlPBtQ22CY4g)

 (image/png)    


[YDBRD-26064文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZjlhMWFkOWEzMzExZGM4ZGYyIiwicmVmX2lkIjoiNjczOTZjZjk3MjgyMDZlZmI5MmYxOTU5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1MDM0LCJleHAiOjE3ODIzOTE0MzR9.ThfVXvi-0Sjp4Cc9tFotr0RnNOgeOSl8j_I2hPutD1A)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
