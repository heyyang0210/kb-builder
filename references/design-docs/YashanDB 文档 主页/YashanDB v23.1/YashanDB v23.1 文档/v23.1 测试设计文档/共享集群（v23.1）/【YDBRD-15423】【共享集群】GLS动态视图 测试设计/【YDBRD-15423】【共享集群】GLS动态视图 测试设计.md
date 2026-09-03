Created by 牛亚娜, last modified on 十一月 08, 2023

# **1. 概述**

本文描述集群GLS动态视图 测试设计

SR:    [YDBRD-15423](https://jira.yasdb.com/browse/YDBRD-15423?src=confmacro)    -  设计、优化GLS视图  完成

开发设计文档：    [集群GLS动态视图](https://conf.yasdb.com/pages/viewpage.action?pageId=113968546)  

# **2. 需求分析**

集群全局锁服务主要涉及两部分内存，一部分是requester实例本地管理的gls lock内存(这部分内存主要记录的这个实例上gls lock的信息，如mode、status、shareCount等)，另一部分是master实例管理的grc lock item内存(这部分内存主要记录的某个lockId的gls lock的ownerMap、ownerCount、Xowner等)。集群GLS动态视图主要展示的是每个实例上的第一部分内存，即这个实例当前申请了哪些gls lock，这些gls lock的状态是怎么样的。不涉及第二部分内存，第二部分属于grc内存，会在grc动态视图中展示。

### 2.1 功能特性

可以查看当前实例本地获取的gls lock类型、全局权限、本地权限的状态信息

|字段|类型|描述|
|---|---|---|
|ID|BIGINT|全局锁ID|
|TYPE|VARCHAR(32)|全局锁TYPE,0: OBJECT_LOCK,1: SEGMENT_LOCK,2: SEGMENT_EXTEND_LOCK,3: INTERVAL_EXTEND_LOCK,4: USER_LOCK,5: SYSTEM_LOCK,6: SPC_EXTENT_LOCK,7: ROLE_LOCK,8: UNKNOWN|
|RESOURCE_NAME|VARCHAR(128)|全局资源ID|
|GLOBAL_STATUS|TINYINT|缓存的MASTE RESOURCE的锁状态，本地释放锁后不会清除MODE,0：NONE,1：SHARE,2：EXCLUSIVE|
|LOCAL_STATUS|TINYINT|本地的锁状态,0：IDLE,1：SHARE,2：INTENTIONAL EXCLUSIVE,3：EXCLUSIVE|
|SHARE_COUNT|SMALLINT|共享锁持有者数量|
|XID|BIGINT|持有排他锁的XRM XID|


### 2.2 规格约束

无

### 2.3 测试范围

- 部署形态：集群
- 部署环境：单主机磁阵+多主机磁阵
- 节点个数：不超过4节点


# **3. 测试**  **设计方法**   

主要采用场景法，等价类划分法。测试点为：

- 根据动态视图的公共测试方法验证视图本身
- 针对所有锁类型构造相应的场景，观测视图各字段返回值的正确性
- 在业务过程中并发查询视图，表现正常


# 4.   **详细测试设计**

### 4.1 动态视图测试

如果新增视图，视图的测试主要从以下几个角度来做验证

- 视图名称的命名规范性
- 新增视图是否有在产品文档里新增对应的资料描述
- 在相关业务场景下，视图字段值的准确性测试
- 视图所包含字段的测试
- 视图查询（是否带filter）的测试
- 视图写操作拦截测试
- 视图并发查询测试


|测试场景|有效等价类|无效等价类|备注|
|:---|:---|:---|:---|
|视图命名的规范性验证|命名规范|命名不规范|  
|
|对应视图在资料中有新增，新增信息是否正确|新增信息正确|新增信息不正确|  
|
|视图所包含字段的测试|字段正确|字段错误|查询时可验证字段的大小写情况|
|视图字段值的准确性测试|字段值准确|字段值不准确|构造相应的场景看字段值是否准确且合理|
|  
|动态值可以被捕获|动态值无法捕获|构造相应的场景看动态值的变化能否被捕捉|
|视图查询（是否带filter）的测试|查询不带filter，查询结果匹配准确|查询不带filter，查询结果匹配不准确|  
|
|  
|查询带filter，filter条件正确|查询带filter，filter条件不正确|  
|
|  
|添加filer后的查询结果匹配准确|添加filer后的查询结果匹配不准确|  
|
|视图写操作拦截测试|drop,insert,delete,update等写操作被拦截，无法成功操作|drop,insert,delete,update等写操作未被拦截，成功操作|  
|
|视图并发查询测试|带业务并发查询视图，表现正常|带业务并发查询视图，表现异常|  
|


### 4.2 业务场景测试

针对所有锁类型构造相应的场景，观测视图各字段返回值的正确性，详见xmind

[GLS动态视图.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5Y2ZhMWFkOWEzMzExZGM3OTE2IiwicmVmX2lkIjoiNjczOTY5Y2Y1OTNmOTljOWZmMjM1MzJjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5MDc4LCJleHAiOjE3ODIyOTU0Nzh9.c_hG9w9L_KaZSEXDnYlZfBL0krBU0H0jixSBYe4zifM)

# 5.   **测试用例**

[YDBRD-15423-GLS视图-文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5Y2Y4OTcwYzJhZjRmNTFmYTlmIiwicmVmX2lkIjoiNjczOTY5Y2Y1OTNmOTljOWZmMjM1MzJjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5MDc4LCJleHAiOjE3ODIyOTU0Nzh9.1LWleD-gjXoUZHCec5LjTn3lkunT2ZbaKLQTKz5O1zY)

[not_automated_sql.rar](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5Y2ZhMWFkOWEzMzExZGM3OTE3IiwicmVmX2lkIjoiNjczOTY5Y2Y1OTNmOTljOWZmMjM1MzJjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5MDc4LCJleHAiOjE3ODIyOTU0Nzh9.Q0Lm_1hyc-40Qt5eWh-5ESiULPbj7c7pWav7EfCgtp8)

# 6.   **测试框架设计**

本次测试使用guider框架，testkill框架  实现

# 7.   **测试环境说明**

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|  
|


## Attachments:

[GLS动态视图.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5Y2Y4OTcwYzJhZjRmNTFmYWEwIiwicmVmX2lkIjoiNjczOTY5Y2Y1OTNmOTljOWZmMjM1MzJjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5MDc4LCJleHAiOjE3ODIyOTU0Nzh9.V3xF47fpaJJesLZCvOWWHm3ffXawr08c9OiDSR-QS5U)

 (application/x-xmind)    


[GLS动态视图.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5Y2ZhMWFkOWEzMzExZGM3OTE4IiwicmVmX2lkIjoiNjczOTY5Y2Y1OTNmOTljOWZmMjM1MzJjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5MDc4LCJleHAiOjE3ODIyOTU0Nzh9.VZlnQg0n_QiJkA4xZMk3PW0Uq66uwnBGco7JZuteFrg)

 (application/x-xmind)    


[GLS动态视图.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5Y2ZhMWFkOWEzMzExZGM3OTE2IiwicmVmX2lkIjoiNjczOTY5Y2Y1OTNmOTljOWZmMjM1MzJjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5MDc4LCJleHAiOjE3ODIyOTU0Nzh9.c_hG9w9L_KaZSEXDnYlZfBL0krBU0H0jixSBYe4zifM)

 (application/x-xmind)    


[YDBRD-15423-GLS视图-文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5Y2Y4OTcwYzJhZjRmNTFmYTlmIiwicmVmX2lkIjoiNjczOTY5Y2Y1OTNmOTljOWZmMjM1MzJjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5MDc4LCJleHAiOjE3ODIyOTU0Nzh9.1LWleD-gjXoUZHCec5LjTn3lkunT2ZbaKLQTKz5O1zY)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[not_automated_sql.rar](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5Y2ZhMWFkOWEzMzExZGM3OTE3IiwicmVmX2lkIjoiNjczOTY5Y2Y1OTNmOTljOWZmMjM1MzJjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5MDc4LCJleHAiOjE3ODIyOTU0Nzh9.Q0Lm_1hyc-40Qt5eWh-5ESiULPbj7c7pWav7EfCgtp8)

 (application/octet-stream)    


## Comments:

|  [](null)  ,1、当前INTENTIONAL EXCLUSIVE属于预留字段，后续如果有对象涉及需要补测,Posted by niuyana at 六月 13, 2023 10:40|
|---|
