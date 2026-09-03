Created by 施新华, last modified on 十二月 15, 2023

# 1.   **概述**

YashanDB数据库目前只支持3节点及以上的自动选举，由于是基于raft的一致性算法，无法做到一主一备进行自动切换，因此引入yasom进行仲裁，当主节点异常的时候，备节点可以自动升主。

# 2.   **需求分析**

**SR：**    [YDBRD-706](https://jira.yasdb.com/browse/YDBRD-706?src=confmacro)    **-**  **【23.1】一主一备下支持自动选举**  **完成**

  [YDBRD-23289](https://jira.yasdb.com/browse/YDBRD-23289?src=confmacro)    **-**  **【OM仲裁】OM支持仲裁yasdb一主一备**  **完成**

  [YDBRD-23293](https://jira.yasdb.com/browse/YDBRD-23293?src=confmacro)    **-**  **【OM仲裁】OM仲裁依赖DB能力**  **完成**

单机主备部署，通过yasom进行仲裁进行主备切换，支持最大性能，最大可用和最大保护模式。

当主节点故障，yasom和备节点都无法与主机通信，yasom下发通知到备节点执行failover，备机处于异常状态或非open模式下无法升主。

新增yasboot命令进行控制并配置相关参数：

yasboot:

1. yasboot   election enable on/off --force       // 开启或关闭选举功能，on：开启自选举，off：关闭自选举，--force：在数据库状态异常的情况下，强制关闭自选举（可能会导致数据库主机无法启动）
1. yasboot election config -k key -v value      // 设置选举相关参数
1. yasboot election config show             // 显示主备选举状态和选举参数配置
1. yasboot election event show            // 显示yasom启动以来，发送的选举相关事件


参数如下（右边为默认值）：

- Failover  Threshold   = 9;                 // 触发failover的心跳超时时间，单位s，取值范围[2,1000]，心跳间隔默认1s，目前无法修改。
- FailoverAutoReinstate = false； //  旧主机连上新主机后，自动执行  **脑裂修复**
- ZeroDataLossMode=true;          //  数据零丢失模式，  **正常情况下以最大保护模式运行，切换后变为最大可用**  ，并禁止自动切换 ，直到旧主机降备并完全同步新主机


## 2.1 基于yasom自动切换流程

基于yasom的自动切换，是外部仲裁模式，由yasom下发切换命令。总共有5个步骤：

1. 检测切换条件是否满足，如：主机是否正常，主备LAG是否过大；
1. 选择日志最多的备机，下发alter database failover命令；
1. 持久化新主node id和reset id；
1. 更新路由等其他操作；
1. 如果旧主机恢复连接，则降备，脑裂修复。


![](https://pingcode.yasdb.com/atlas/files/public/673969a48970c2af4f51f9a4/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFFQUFBQUFBQUFBQUNFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUNDQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDc5NzQsImV4cCI6MTc4MjIxODc3NH0.cOsUZeh5zJkKzeLk0vAFI0XM5O9M4K2CnCeKiKNkKpM)

## 2.2 切换模式

1. 普通模式：适用于最大可用、最大性能。切换限制少，但不保证RPO=0, RTO < 30s，数据可能丢失；
1. 零丢失模式：适用于最大保护。只在确保备机不丢数据的情况下，即RPO=0，才执行自动切换，RTO < 30s，否则等待人工介入；


#### 零丢失模式（一主一备）

一主一备，如果RPO必须是0，只能是最大保护模式，但是备库断连后，会影响主库写业务。为了兼顾自动切换的RPO=0和主库的可用性，设计了一个带限制的自动切换方案，保证数据不丢失的情况下，再去切换：

1. 部署时，主备都设成最大保护，并在OM上设置zero_lose=TRUE
1. 如果备库断连，导致主库业务阻塞后，OM将主库降为最大可用，并设置zero_lose=FALSE
    1. 当备库恢复连接后，等待备库同步REDO后，再将主库升为最大保护，并设置zero_lose=TRUE
1. 如果主库宕机，触发选举后，OM先判断zero_lose
    1. zero_lose为FALSE，说明数据可能丢失，不自动切换，等待人工介入
    1. zero_lose为TRUE，说明数据不丢失，先将zero_lose置为FALSE，备机升主，然后设为最大可用（因为旧主库挂了，新主库没有备库，只能设为最大可用）
1. 旧主库降备后，需要等待REDO同步后，再将新主库升为最大保护，并设置zero_lose=TRUE


原则就是，  **主备都是最大保护模式的时候，可以自动切换，如果是最大可用模式，只能手动切换。**

## 2.3 切换条件

1. 自动切换开启，主机和备机均已OPEN，并且备机不是NEED REPAIR状态；
1. yasom与主机失联时间超过  Failover  Threshold，并且目标备机与主机断连；
1. 如果是  **零丢失模式**  ，备机不丢失数据的情况下，才能自动切换   。    


备机监控项：

|connect status|v$replication_status|备机上查，与主机的连接状态，所连主机的IP，node-id等|
|:---|:---|:---|
|DB role|v$database|主备角色|
|DB status|v$database|normal，need repair（备），redo mismatch(备)，abnormal（主）|
|flush point|v$database|日志刷盘点（主）或日志回放点（备）|
|open mode|v$database|nomount，mount，open|
|recv point|v$replication_status|备机日志接收点|


## 2.4 新主选择

通常是选择日志最多的备机，执行failover，以减少数据丢失。此方案只考虑一主一备，无需选择。

## 2.5 切换后处理

切换到新主后，如果yasom能重新连接到旧主机，此时会有以下几种状态：

1. 旧主机OPEN，角色为Primary
1. 旧主机OPEN，角色已经转换为Standby
1. 旧主机正在重启
1. 旧主机无法启动


##### **旧主机降备**

1. 如果旧主机处于OPEN模式并且为Primary角色，则先shutdown abort，重新open
1. 在mount模式下，接收到  **yasagent的心跳，获取到自己的角色**  为standby，该进程自行降备，并open


##### **脑裂修复**

在最大性能模式下，由于redo是异步发送，很可能备机（新主机）的日志比旧主机少，所以容易发生redo分叉，导致数据不一致，即脑裂

最大可用模式也可能出现脑裂

当FailoverAutoReinstate参数为TRUE时，yasom会在旧主机降备后，尝试修复脑裂数据。

1. 等待主机连接到备机
1. 在主机上执行build database repair standby ‘name’


注：为防止数据丢失或不一致，在脑裂被修复前，该备机不能自动升主，也就是说。新主机挂了之后，若备机是NEED REPIAR状态，不能自动切换，需要人工介入

# 3.   **测试组网**

![](https://pingcode.yasdb.com/atlas/files/public/673969a4a1ad9a3311dc781b/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFFQUFBQUFBQUFBQUNFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUNDQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDc5NzQsImV4cCI6MTc4MjIxODc3NH0.cOsUZeh5zJkKzeLk0vAFI0XM5O9M4K2CnCeKiKNkKpM)

# 4.   **应用场景**

单机1主1备部署模式下，当主节点故障可以自动切换到备机。

# 5.   **详细测试设计**

1）详细设计如下xmind内容。

[一主一备支持自动选举.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YTM4OTcwYzJhZjRmNTFmOTlkIiwicmVmX2lkIjoiNjczOTY5YTM3MjgyMDZlZmI5MmVmNTdhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA3OTc0LCJleHAiOjE3ODIyOTQzNzR9.Pm2yO42ZLtiE3p0yVia6JWQykIAII5Yl3TB86q7SgdM)

2）该特性是否涉各个专项测试，并在详细设计中描述具体测试点。

|专项|是否涉及|
|:---|:---|
|并发|是|
|长稳|  
|
|一致性|  
|
|三方测试工具    
  (sqltest，sqlancer)|  
|
|安全|  
|
|DFR/testkill|  
|
|HA|是|
|压力|  
|
|性能|  
|
|可维护性|是|


  


# 6.   **测试用例**

[一主一备支持自动切换用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YTM4OTcwYzJhZjRmNTFmOTlmIiwicmVmX2lkIjoiNjczOTY5YTM3MjgyMDZlZmI5MmVmNTdhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA3OTc0LCJleHAiOjE3ODIyOTQzNzR9.Ag6fXAz6PzSxEFX4kMJ9vOeJp8E7rKgAno3N76LGIyo)

# 7.   **测试框架设计**

采用现有regress ha框架，需要新增函数。

# 8.   **测试环境说明**

|VM个数|操作系统|配置|
|---|---|---|
|2|CentOS Linux release 7.9.2009 (Core)|CPU： 8核， 内存：20G|


# 9. 测试工作量

     1.5人/周

## Attachments:

[image2022-12-20_11-44-18.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YTNhMWFkOWEzMzExZGM3ODE0IiwicmVmX2lkIjoiNjczOTY5YTM3MjgyMDZlZmI5MmVmNTdhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA3OTc0LCJleHAiOjE3ODIyOTQzNzR9.r-ZkYHjtQeHKRqeXf8wJYemiknJ5Q1yOGmSg7Ly2ZKM)

 (image/png)    


[image2022-12-20_11-45-39.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YTM4OTcwYzJhZjRmNTFmOWEyIiwicmVmX2lkIjoiNjczOTY5YTM3MjgyMDZlZmI5MmVmNTdhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA3OTc0LCJleHAiOjE3ODIyOTQzNzR9.82fJCKedWXCfTKpj4R_KIXiIgTuMqkNz1lQeogJtBEM)

 (image/png)    


[image2022-12-20_14-5-31.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YTNhMWFkOWEzMzExZGM3ODE2IiwicmVmX2lkIjoiNjczOTY5YTM3MjgyMDZlZmI5MmVmNTdhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA3OTc0LCJleHAiOjE3ODIyOTQzNzR9.lw9qJvTSB_zJaJHeug20s3SNjcg1yRmpnWyNhTuhkjw)

 (image/png)    


[一主一备支持自动选举.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YTM4OTcwYzJhZjRmNTFmOTlkIiwicmVmX2lkIjoiNjczOTY5YTM3MjgyMDZlZmI5MmVmNTdhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA3OTc0LCJleHAiOjE3ODIyOTQzNzR9.Pm2yO42ZLtiE3p0yVia6JWQykIAII5Yl3TB86q7SgdM)

 (application/x-xmind)    


[一主一备支持自动切换用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YTM4OTcwYzJhZjRmNTFmOTlmIiwicmVmX2lkIjoiNjczOTY5YTM3MjgyMDZlZmI5MmVmNTdhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA3OTc0LCJleHAiOjE3ODIyOTQzNzR9.Ag6fXAz6PzSxEFX4kMJ9vOeJp8E7rKgAno3N76LGIyo)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
