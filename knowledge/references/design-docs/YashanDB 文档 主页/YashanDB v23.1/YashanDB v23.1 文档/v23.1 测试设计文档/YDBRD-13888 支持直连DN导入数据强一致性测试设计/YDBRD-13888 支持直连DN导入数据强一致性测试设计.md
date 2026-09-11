Created by 施新华 on 十一月 14, 2023

开发设计：    [强制同步GTS方案设计 - 何阳 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=109589086)  

SR：    [YDBRD-13888](https://jira.yasdb.com/browse/YDBRD-13888?src=confmacro)    -  支持直连DN导入数据强一致性  完成

# **1. 概述**

本文描述强制同步GTS功能的测试设计，隔一段时间，GTS服务同步SCN到各个节点上，因此在这段时间窗内，各个节点上的SCN可能是不一致的，会存在多CN不是立即可读的问题。同理，对于数据导入，在这个时间窗内，也可能存在直连DN导入数据之后，在CN上查询数据不是立即可读的。因此需要支持一个命令，强制同步SCN到各个节点上。

# **2. 需求分析**

- 将CN上的SCN强制推进到跟MN节点SCN一致。在必要场景下使用强制同步SCN的语句，比如：多CN立即可读，或者数据导入之后，查询数据等场景下使用，其他场景不需要执行此语句去强制同步SCN。
- 执行命令：ALTER   SYSTEM FLUSH GTS;


- 约束：    

-     1. 执行这个SQL语句，只保证把当时MN上的SCN同步到CN节点
    1. 单机不支持此语法，只有在CN节点上才能执行这个语句

- 流程分析：


执行流程

![](https://pingcode.yasdb.com/atlas/files/public/67396992a1ad9a3311dc779b/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDcyOTMsImV4cCI6MTc4MjIxODA5M30.Gu0jfVr3QHJRz7HyvRVAVW6mviatkXF4YnVII8BhJbg)

执行步骤：

1. CN节点服务端收到  ALTER SYSTEM FLUSH GTS  语句，解析，校验
1. 获取CN本地SCN，发送ICS_CMD_GET_SCN消息到MN节点
1. MN节点收到获取SCN消息，比对MN本地SCN(当前时戳生成)和CN发送过来的SCN+1,返回最大的SCN到CN节点
1. CN收到ICS_CMD_GET_SCN_ACK，刷新本地SCN，然后将ALTER SYS消息发送给其他CN节点，等待回应
1. 其他CN节点收到ALTER SYS消息，刷新SCN，然后返回ACK消息给CN节点
1. CN返回成功消息给客户端


**在导入工具数据导入后，为了CN节点上能够达到立即可读能力，需要在导入工具完成导入，返回给用户之间，增加一个强制同步GTS的SQL命令**

### 并行执行

1. 并发执行强制同步GTS的语句时，CN节点会刷新此时最大的SCN到本节点上，在MN节点上可能存在抢锁行为
1. ALTER SYSTEM FLUSH GTS  和  COMMIT  语句存在并发抢锁问题，可能在MN节点上拿取SCN时抢锁，不过出现锁冲突概率比较小，因为MN节点上获取SCN的锁范围很小


 故障恢复

1. 只涉及到CN和MN节点，在执行同步GTS的SQL时，DN异常，无影响。
1. 部分CN节点异常时，异常CN节点未刷新SCN，正常节点能够成功刷新SCN，SQL语句最终返回失败
1. 其他故障处理跟修改配置参数一致


  


# **3. 测试**  **设计方法**   

主要采用场景法，边界值法等测试方法。

# 4.   **详细测试设计**

[支持直连DN导入数据强一致性测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5OTI4OTcwYzJhZjRmNTFmOTIzIiwicmVmX2lkIjoiNjczOTY5OTE3MjgyMDZlZmI5MmVmNDkwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA3MjkzLCJleHAiOjE3ODIyOTM2OTN9.CjyyLk64BDLIh_YpxPfIb60ZlMPU1Gy9FUIyjeX9-BE)

# 5.   **测试用例**

# 6.   **测试框架设计**

本次测试现有的导数测试框架+手动测试。

# 7.   **测试环境说明**

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|  
|


## Attachments:

[支持直连DN导入数据强一致性测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5OTI4OTcwYzJhZjRmNTFmOTIzIiwicmVmX2lkIjoiNjczOTY5OTE3MjgyMDZlZmI5MmVmNDkwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA3MjkzLCJleHAiOjE3ODIyOTM2OTN9.CjyyLk64BDLIh_YpxPfIb60ZlMPU1Gy9FUIyjeX9-BE)

 (application/x-xmind)    
