Created by 刘顺鹏, last modified on 一月 24, 2024

  [YDBRD-25038](https://jira.yasdb.com/browse/YDBRD-25038?src=confmacro)    -  【OM】支持一键式更新数据库和OM的IP更换  完成

## 1. OverView（概述）

IP的变动可能会导致已部署的数据库不可用，所以提供IP更换功能，通过yasboot和SSH的方式，把OM和DB相关进程的IP更换为新的可用的IP。

假如原有IP可用，也可以更换。

## 2. Feature（功能特性）

1. yasom和 yasagent更换IP
1. 单机DB更换IP


## 3. Interfaces （接口）

--new-ip和--new-cidr互斥

OM:

1. ipchange yasom      新增参数：


|长参|短参|含义|限制|
|:---|:---|:---|:---|
|--hosts|-t|hosts.toml|必填|
|--new-ip|-n|新IP|  
|


1. ipchange yasagent     新增参数：


|长参|短参|含义|限制|
|:---|:---|:---|:---|
|--new-ip|-n|新IP|  
|
|--hosts|-t|hosts.toml|必填|
|--host-id|  
|替换yasagent的host-id,  如：host0001|必填|


 new-ip和new-cidr必填其一

DB:

1.  ipchange host   新增参数
1.   



|选项|含义|
|---|---|
|*-t, --toml*|config gen生成的hosts.toml（必传参数）|
|*-l, --listen-ip*|数据库的监听地址的新IP|
|*-r, --replica_ip*|主备复制链路地址的新IP|
|*-lc, --listen-cidr*|数据库的监听地址的新网段，可以填写多个，例如: 192.168.1.2/24,0.0.0.0/0|
|*-rc, --replica-cidr*|主备复制链路地址的新网段，可以填写多个，例如: 192.168.1.2/24,0.0.0.0/0|
|*--host-id*|要更换yasagent的主机的id，例如：host0001，可参见hosts.toml|
|*-s, --start*|完成本次IP更换后，自动启动数据库|


1. replica、listen或其网段不填，则使用本机上yasagent的ip
1. 不填host-id,则默认给所有主机的db更换IP，此时建议使用listen-cidr和replica-cidr，yasboot会根据网段自动为每台主机的listenaddr和replicationaddr找到合适的ip。假如不填写，则使用本机上yasagent的ip


## 4. Specification And Constraints（规格与约束）

无

## 5. Detail Design（详细设计）

### 5.1 Data Structures & Flow（数据结构与流程）

#### 5.1.1 总体流程图

![](https://pingcode.yasdb.com/atlas/files/public/67396c868970c2af4f520c92/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDEzNjAsImV4cCI6MTc4MjMxMjE2MH0.mDGgD_fvwZLQ3FFFlMY4lUPRKNIRtkjPKg6Fd3YFnwM)

  


更换逻辑：

1. om必须可用，才有能力去更换yasagent。假如om的ip不可用，则需要更换om的ip。更换后会重启om，使om可用。
1. 每个yasagent都必须可用，才有能力去更换host上的db。按照背景，至少会有一台机器ip不可用，使yasagent的ip不可用。所以至少需要更换一次yasagent，使所有yasagent可用，每次更换都会重启当前yasagent。
1. om、yasagent都可用了，此时才有能力更换db。以主机为单位，修改主机上的db节点，每次修改前都会停止db节点。
1. 等所有host更改完成后，启动db节点，此时集群可用。


### 5.1.2 对网段的处理

总是在yasboot层，在开始一切处理之前，把输入的网段转换成一个IP。

### 5.1.3 更换yasom

1. 执行yasboot ipchange yasom -n 192.168.1.2 -t hosts.toml    

1. yasboot先ssh到目标机器
1. 修改yasom.toml
1. 停止yasom进程
1. 启动yasom进程
1. 退出ssh
1. yasboot rpc调用yasom，修改kv_config表中的om_addr
1. 修改本地的env文件


### 5.1.4 更换 yasagent

1. 执行yasboot ipchange yasagent -n 192.168.1.2 -t hosts.toml  --hosts-id host0001    

1. yasboot读取本地env文件，获知新om_addr
1. yasboot ssh到目标机器
1. 修改yasagent.toml，根据om_addr修改env文件
1. 停止yasagent进程
1. 拉起yasagent进程
1. yasboot调用om修改host表中的manage_ip和listen_addr
1. 更新taskmanager的hoste
1. 退出ssh


### 5.1.5 以主机为单位对DB进行更换

1. 让OM遍历所有host，通过任务让每个agent去处理自己的主机
1. agent读取node.toml， 得知自己有哪些节点，对于每个节点，先杀死进程，在更换节点的yasdb.ini
1. 遍历yasdb.ini， 对ip进行替换。
1. 提供 --start 参数，假如命令中有这个参数，在执行完时，会重启整个集群。


  


## 6. Testcases（自测用例）

两台主机组建的单机数据库，一台主机的IP不可用，可用通过以上命令，替换成新的IP，然后数据库可以正常使用

## 7. Document（资料）

## 8. Workload（工作量）

评估代码量KLOC、工作量（人天）。

## 9. TODO（遗留问题）

  


  


## Attachments:

[ip迁移.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjODZhMWFkOWEzMzExZGM4YjAyIiwicmVmX2lkIjoiNjczOTZjODY3MjgyMDZlZmI5MmYxMzlmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAxMzYwLCJleHAiOjE3ODIzODc3NjB9.0h-1dORqIIV2Akmjf-xPQb6mPR1LdFT88KVjZtm7Fe8)

 (image/png)    


## Comments:

|  [](null)  ,分布式，视图，变更是否一致    
  集群，ycs status，节点信息是否一致,Posted by liushunpeng at 一月 16, 2024 14:37|
|---|
|  [](null)  ,newip 和 newcidr 互斥,Posted by liushunpeng at 一月 16, 2024 14:43|
|  [](null)  ,om agent 新命令,Posted by liushunpeng at 一月 16, 2024 14:44|
|  [](null)  ,INTER_URL  CLUSTER_INTERCONNECT,Posted by liushunpeng at 一月 16, 2024 15:14|
|  [](null)  ,yascs.ini 集群 也需要改ip,Posted by liushunpeng at 一月 16, 2024 15:21|
|  [](null)  ,集群的停止脚本，stop.sh ip需要更换,Posted by liushunpeng at 一月 16, 2024 15:24|
|  [](null)  ,资料提示白名单修改,Posted by liushunpeng at 一月 16, 2024 15:26|
