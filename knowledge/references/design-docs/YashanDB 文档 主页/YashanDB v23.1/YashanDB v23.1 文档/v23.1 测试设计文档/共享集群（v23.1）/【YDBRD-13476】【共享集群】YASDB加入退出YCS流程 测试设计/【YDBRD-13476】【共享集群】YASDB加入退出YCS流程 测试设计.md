Created by 牛亚娜, last modified on 十一月 08, 2023

# **1. 概述**

本文描述集群  YASDB加入退出YCS流程  测试设计

SR:    [YDBRD-13476](https://jira.yasdb.com/browse/YDBRD-13476?src=confmacro)    -  【共享集群】YASDB加入退出YCS流程  完成

开发设计文档：    [崖山集群资源启动停止设计方案](https://conf.yasdb.com/pages/viewpage.action?pageId=109581586)  

# **2. 需求分析**

资源YASDB是根据资源配置伴随YCS启动一起加入集群，也可在YCS集群运行过程中，通过客户端发送命令加入退出集群。集群会监控资源实时状态，当监测到实时状态与目标状态不符，做相应操作使之达成目标状态

命令参考：

- ycsctl start instance
- ycsctl stop instance


### 2.1 功能特性

- 启动DB资源：在ycs系统启动时，或在监控时根据需要启动资源，并使加入到系统topo中
- 停止DB资源：在ycs系统停止时，或在监控时根据需要停止资源，并使加入到系统topo中


### 2.2 规格约束

- DB资源总量不超过64个（当前不超过4个，主要测试3节点）
- 支持正常启停和主备切换
- DB资源不支持并发启停（相同节点可以，不同节点不可以）


### 2.3 测试范围

- 部署形态：集群
- 部署环境：单主机磁阵+多主机磁阵
- 节点个数：不超过4节点


# **3. 测试**  **设计方法**   

主要采用场景法，正交组合法，错误推测法。测试点为：

- DB加入和退出YCS的过程中，各分支处理正常，异常时报错合理
- DB加入退出YCS时，不会对其他资源和服务有影响（YFS资源，YCS服务）
- DB加入退出YCS成功后，执行串行/并行业务正常
- 在同一节点，DB并发启停正常，之后执行业务正常
- 两节点下，DB业务与YCS启停并发正常


# 4.   **详细测试设计**

 

[YASDB加入退出YCS.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YjhhMWFkOWEzMzExZGM3OGExIiwicmVmX2lkIjoiNjczOTY5Yjg3MjgyMDZlZmI5MmVmNjg4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4NTQxLCJleHAiOjE3ODIyOTQ5NDF9.-W16qLzFi_wbGT230xqQCizimaBCj1Wq7S39Cv-k6LM)

# 5.   **测试用例**

[YDBRD-13476-YASDB加入退出YCS-测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5Yjg4OTcwYzJhZjRmNTFmYTJhIiwicmVmX2lkIjoiNjczOTY5Yjg3MjgyMDZlZmI5MmVmNjg4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4NTQxLCJleHAiOjE3ODIyOTQ5NDF9.JrLOeKUcQyMWsxi7ZVCISj-JK5PLNbBA7u5TNsPgVPc)

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

[YASDB加入退出YCS.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YjhhMWFkOWEzMzExZGM3OGExIiwicmVmX2lkIjoiNjczOTY5Yjg3MjgyMDZlZmI5MmVmNjg4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4NTQxLCJleHAiOjE3ODIyOTQ5NDF9.-W16qLzFi_wbGT230xqQCizimaBCj1Wq7S39Cv-k6LM)

 (application/x-xmind)    


[YDBRD-13476-YASDB加入退出YCS-测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5Yjg4OTcwYzJhZjRmNTFmYTJhIiwicmVmX2lkIjoiNjczOTY5Yjg3MjgyMDZlZmI5MmVmNjg4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4NTQxLCJleHAiOjE3ODIyOTQ5NDF9.JrLOeKUcQyMWsxi7ZVCISj-JK5PLNbBA7u5TNsPgVPc)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


## Comments:

|  [](null)  ,2023/6/12评审：启停DB脚本权限和内容相关验证（是否有详细的报错提示等）需由李世铭进行补测,Posted by niuyana at 六月 12, 2023 16:33|
|---|
|  [](null)  ,在同一个实例的两个进程中同时执行start ycs和stop ycs时，当前会报错YAS-02050 the database is busy, try again later，是为了不影响启动流程，意思就是启动过程中不允许shutdown；在这个过程中，ycs 没有强制停止db的流程，一直要等db停止后第一次执行的ycsctl stop ycs进程才会退出，这个时候会有ycsctl stop ycs进程一直挂着，如果再继续在当前实例上执行stop instance命令，会直接退出【后续迭代需求解决】,1. ycsctl 工具层拦截了，不让并发执行同一个命令，但是ycsctl 工具层没有返回具体报错信息给到客户端，就直接退出----杜宇轩    
  2. ycs 停止db 流程里面，等db退出没有超时，db只要不退出ycs就不会停，现在要做强制退出db需求----李雪峰,Posted by niuyana at 六月 27, 2023 20:32|
