Created by 牛亚娜, last modified on 十一月 08, 2023

# **1. 概述**

本文描述集群GRC动态视图与系统统计 测试设计

SR:     [YDBRD-13415](https://jira.yasdb.com/browse/YDBRD-13415?src=confmacro)    -  【共享集群】GRC动态视图与系统统计  完成

开发设计文档：    [动态视图设计](https://conf.yasdb.com/pages/viewpage.action?pageId=109583364)  

# **2. 需求分析**

### 2.1 相关视图

####   [V$GRC_RESOURCE](https://conf.yasdb.com/pages/viewpage.action?pageId=109583364#vgrc-resource)  

该视图显示共享集群全局master资源情况 。

|字段|类型|描述|
|---|---|---|
|RESOURCE_NAME|VARCHAR(128)|资源名称, block资源 [space][file][id]; lock资源 [id],[type]|
|TYPE|TINYINT|资源类型 0：BLOCK; 1：LOCK|
|XOWNER|TINYINT|持有写锁或最近一次持有写锁的节点|
|OWNER_COUNT|TINYINT|持有资源的节点数|
|OWNER_MAP|BIGINT|持有资源的节点位图，64位整型值，每一位代表节点的ID，如果该节点持有资源，ownerMap中对应的位设置为1|
|PASTCOPY_MAP|BIGINT|对于BLOCK资源，存在PASCOPY资源，此字段标记持有该BLOCK的PASTCOPY资源的节点|
|IN_PROCESS|BOOLEAN|是否有节点请求获取当前资源|
|REQUEST_COUNT|TINYINT|资源上当前请求消息数量|


####   [V$RESSOURCE_REQUEST](https://conf.yasdb.com/pages/viewpage.action?pageId=109583364#vressource-request)  

该视图显示共享集群资源当前等待处理的消息 。

|字段|类型|描述|
|:---|:---|:---|
|RESOURCE_NAME|VARCHAR(128)|资源名称|
|TYPE|INTEGER|请求消息类型|
|INSTANCE_ID|INTEGER|发出请求消息的节点ID|
|SESSION_ID|INTEGER|发出请求消息的会话ID|
|SERIAL_NO|INTEGER|请求消息的序列号|
|IN_PROCESS|BOOLEAN|当前请求是否正在处理|


####   [V$GRC_DHTRULE](https://conf.yasdb.com/pages/viewpage.action?pageId=109583364#vgrc-dhtrule)  

该视图显示共享集群中master资源的hash分布情况 。

|字段|类型|描述|
|:---|:---|:---|
|INSTANCE_ID|INTEGER|节点ID|
|HASH_ID|INTEGER|hash值|
|VERSION|INTEGER|当前GRC版本号(每一次重分布，version不一样)|


### 2.2 测试范围

- 部署形态：集群
- 部署环境：单主机磁阵+多主机磁阵
- 节点个数：不超过4节点


# **3. 测试**  **设计方法**   

主要采用场景法，等价类划分法。测试点为：

- 根据动态视图的公共测试方法验证视图本身
- 构造相应的场景，观测视图各字段返回值的正确性
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

结合block资源和lock资源的消息流场景，构造相关测试点，校验视图的返回结果是否符合预期，详见xmind

[GRC动态视图.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YjA4OTcwYzJhZjRmNTFmOWVkIiwicmVmX2lkIjoiNjczOTY5YjA1OTNmOTljOWZmMjM1MWFiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4MzYwLCJleHAiOjE3ODIyOTQ3NjB9._hzsKediEKtIJOhNxclbaVSIejfqATJC1u8f17WCnIM)

# 5.   **测试用例**

[YDBRD-13415-GRC视图-测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YjBhMWFkOWEzMzExZGM3ODY0IiwicmVmX2lkIjoiNjczOTY5YjA1OTNmOTljOWZmMjM1MWFiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4MzYwLCJleHAiOjE3ODIyOTQ3NjB9.zFl4aazzyAHTCRaFpW0_R7fW2D0sD51TeZmSIzd_Edo)

[YDBRD-13415-未自动化业务用例.rar](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YjA4OTcwYzJhZjRmNTFmOWVmIiwicmVmX2lkIjoiNjczOTY5YjA1OTNmOTljOWZmMjM1MWFiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4MzYwLCJleHAiOjE3ODIyOTQ3NjB9.L1TPZr1jjwFQ2xXWyriV_ogCMODJ1n6FNElfAaRr2ww)

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

[GLS动态视图.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YjBhMWFkOWEzMzExZGM3ODY1IiwicmVmX2lkIjoiNjczOTY5YjA1OTNmOTljOWZmMjM1MWFiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4MzYwLCJleHAiOjE3ODIyOTQ3NjB9.RlX6HaJSAUYkNSiTUAub6QQgvCL_ePA-eSbyvLMGUbc)

 (application/x-xmind)    


[GRC动态视图.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YjBhMWFkOWEzMzExZGM3ODY2IiwicmVmX2lkIjoiNjczOTY5YjA1OTNmOTljOWZmMjM1MWFiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4MzYwLCJleHAiOjE3ODIyOTQ3NjB9.pPix8sPXOZbldEgXCDvSF1yrpautbq76J91qvpAUb8U)

 (application/x-xmind)    


[GRC动态视图.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YjA4OTcwYzJhZjRmNTFmOWVkIiwicmVmX2lkIjoiNjczOTY5YjA1OTNmOTljOWZmMjM1MWFiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4MzYwLCJleHAiOjE3ODIyOTQ3NjB9._hzsKediEKtIJOhNxclbaVSIejfqATJC1u8f17WCnIM)

 (application/x-xmind)    


[YDBRD-13415-GRC视图-测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YjBhMWFkOWEzMzExZGM3ODY3IiwicmVmX2lkIjoiNjczOTY5YjA1OTNmOTljOWZmMjM1MWFiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4MzYwLCJleHAiOjE3ODIyOTQ3NjB9.3Pptc1ua0WOGEblYd6_r0gNjg3kedUc_chF5XWvWAhU)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[YDBRD-13415-GRC视图-测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YjBhMWFkOWEzMzExZGM3ODY0IiwicmVmX2lkIjoiNjczOTY5YjA1OTNmOTljOWZmMjM1MWFiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4MzYwLCJleHAiOjE3ODIyOTQ3NjB9.zFl4aazzyAHTCRaFpW0_R7fW2D0sD51TeZmSIzd_Edo)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[YDBRD-13415-未自动化业务用例.rar](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YjA4OTcwYzJhZjRmNTFmOWVmIiwicmVmX2lkIjoiNjczOTY5YjA1OTNmOTljOWZmMjM1MWFiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4MzYwLCJleHAiOjE3ODIyOTQ3NjB9.L1TPZr1jjwFQ2xXWyriV_ogCMODJ1n6FNElfAaRr2ww)

 (application/octet-stream)    
