Created by 徐凡博, last modified on 二月 28, 2024

### SR链接：

-   [YDBRD-13464](https://jira.yasdb.com/browse/YDBRD-13464?src=confmacro)    -  【共享集群】支持启停YCS节点  完成
-   [YDBRD-13489](https://jira.yasdb.com/browse/YDBRD-13489?src=confmacro)    -  【共享集群】YCS实例管理基础设施  完成
-   [YDBRD-13491](https://jira.yasdb.com/browse/YDBRD-13491?src=confmacro)    -  【共享集群】YCS集群管理软件的通信能力  完成


### 开发设计文档：

-   [【YCS】YCS支持节点启停](109584076.html)  


# **1、概述**

崖山集群服务（后续简称YCS）负责管理共享集群数据库，包括：集群节点管理，节点的加入退出，故障仲裁；集群资源管理，例如数据库、文件系统、浮动IP（技术项目阶段暂不支持）等等，维护资源依赖关系，启停、监控节点上的资源，并提供查询节点资源拓扑的接口能力方便被管理资源根据拓扑信息进行集群重组。

# **2、需求分析**

## 2.1   基本功能特性

|功能|  
,设计表现|设计说明|涉及接口|
|:---|:---|:---|---|
|YCS进程启动|通过命令行拉起YCS进程|客户端工具进程直接启动YCS进程|ycsctl start ycs|
|YCS进程停止|通过命令行停止YCS进程|客户端工具发送停止命令到YCS服务端，服务端自行停止|ycsctl stop ycs|
|YCS集群初始化|启动流程自动触发|首个启动节点对投票盘进行初始化|ycsctl status（第一个节点首次启动后查看）|
|YCS节点加入集群|启动流程自动触发|主节点正常启动及备节点向主节点申请加入集群|ycsctl start ycs|
|YCS节点退出集群|退出流程自动触发|备节点退出集群|ycsctl stop ycs|
|YCS节点主备切换|退出流程自动触发|主节点先转移主角色再退出集群|ycsctl stop ycs|
|YCS topo状态查看|通过命令查看topo状态|客户端工具从服务端获取topo信息并展示|ycsctl status|


## 2.2 启停并发

1）两节点场景，支持不带DB的YCS启停并发

2）三节点场景，不带DB的YCS启停操作和DB启停操作可并发   （DB之间不能并发）

## 2.3 ICS通讯框架相关

1）节点启动后，可正常运行，下发业务； 

2）节点停止后，可正常显示topo信息，无报错；

3）监听处理网络异常事件，仅指两节点环境，不带DB，kill -9 yascs进程的场景。   （重复拉起杀掉，优先级低）

# **3、规格范围**

1）部署形态：集群

2）节点数量：最大4节点（测试时以3节点为测试场景）

3）部署模式：单主机磁阵+多主机磁阵

# **4、约束限制**

1）目前只支持2节  （正常启停三节点可测）

a. 基于2节点进行加固补充

b. 多节点支持功能跟当前持平   

2）异常场景不支持

a. 节点异常退出、磁阵异常、网络异常等异常场景不支持

        b. 正常的并发、错误处理需要处理

3）不支持带DB并发启停

4）不带DB支持两节点并发启停，不支持三节点及以上并发启停

5）暂不支持告警日志

6）DFX部分本SR不交付

7）配置参数由单独SR交付，本SR中配置参数仅用于构造启停流程中部分异常的场景。

8）YCS启停流程的异常分支由UT覆盖（开发文档5.2.2流程图），可利用配置参数构造异常场景。

# **5、动态视图/配置参数**

由单独SR交付。

# **6、测试设计方法**

测试涉及主要采用场景法，等价划分类，正交组合法，错误推测法。

测试点主要涉及以下几方面：

**1）YCS正常启停**  ，其中涉及节点初始化、节点加入/退出集群、topo状态变化等；

**2）YCS启停全流程中的异常分支部分覆盖**  ，本部分主要通过修改配置参数等方式设置，以覆盖部分测试可观测的异常流程，其余由UT覆盖（不带DB部分YCS由徐凡博覆盖，DB异常启动由牛亚娜覆盖）；

**3）YCS启停前后支持DB的业务**  **；**

**4）YCS启停时间点的角度；**

**5）YCS启停涉及到主备角色的角度；**

**6）YCS节点的启停次数的角度；**

**7）YCS启停结合DB交互的角度；**

**8）并发启停**  ，主要两节点YCS启停（不带DB）并发、两节点三节点YCS启停（不带DB）与DB启停并发（徐凡博）、两节点YCS启停和DB业务并发（牛亚娜）；（覆盖YCS主和DB主不在一个节点的场景）

**9）网络异常监测**  ，本部分主要验证ICS适配。

# **7、详细测试设计**

[YDBRD-13464-【共享集群】支持启停YCS节点测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YjNhMWFkOWEzMzExZGM3ODc0IiwicmVmX2lkIjoiNjczOTY5YjI3MjgyMDZlZmI5MmVmNjRjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4NDY4LCJleHAiOjE3ODIyOTQ4Njh9.ZCBDRnkYeuaWmXSq0OLzA6_uAd5KbWdNau4kVxgNaSk)

# **8、测试用例**

[YDBRD-13464-【共享集群】支持启停YCS节点 v1.0.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YjNhMWFkOWEzMzExZGM3ODc1IiwicmVmX2lkIjoiNjczOTY5YjI3MjgyMDZlZmI5MmVmNjRjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4NDY4LCJleHAiOjE3ODIyOTQ4Njh9.QnzV5pVptBkWdQWmPFvTWvrXI3gjdtc2b-RMxb-QwUk)

# **9、测试框架/测试用例自动化**

基本功能：Guider

并发：HA

# **10、测试环境说明**

**OS: **  Linux

**集群形态：**  三实例集群

# **11、测试版本**

## Attachments:

[YDBRD-13464-【共享集群】支持启停YCS节点 v1.0.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YjNhMWFkOWEzMzExZGM3ODc1IiwicmVmX2lkIjoiNjczOTY5YjI3MjgyMDZlZmI5MmVmNjRjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4NDY4LCJleHAiOjE3ODIyOTQ4Njh9.QnzV5pVptBkWdQWmPFvTWvrXI3gjdtc2b-RMxb-QwUk)

 (application/x-xmind)    


[YDBRD-13464-【共享集群】支持启停YCS节点测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YjNhMWFkOWEzMzExZGM3ODc0IiwicmVmX2lkIjoiNjczOTY5YjI3MjgyMDZlZmI5MmVmNjRjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4NDY4LCJleHAiOjE3ODIyOTQ4Njh9.ZCBDRnkYeuaWmXSq0OLzA6_uAd5KbWdNau4kVxgNaSk)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


## Comments:

|  [](null)  ,2023.6.7  对齐记录,1、"YCS集群初始化”功能观测手段为：在首次启动第一个节点后，查看节点TOPO信息正常即可。,2、关于节点数目，正常启停为3节点，异常和并发场景仅覆盖两节点，异常这里仅指kill -9 yascs进程，YCS启停并发仅覆盖不带DB的YCS并发。,    1）2节点场景下，启停过程中下业务是支持的，业务和启停操作都可以成功;,    2）3节点场景下，启停过程中下业务不支持,3、ycsctl set 命令不交付。,4、ICS自测用例中，集群拉起后停止为仅停1个节点。,5、YCS启停操作和DB启停操作并发是否支持？,     1）在DB有主节点时，3节点场景下，YCS启停操作和DB启停操作是可以并发的，互相不受影响，都可以操作成功,     2）在DB没有主节点时，不管3节点还是2节点，YCS启停操作和DB启停操作是不可以并发的（属于故障场景，本SR不交付）,6、关于配置参数这块会有单独的SR交付，本SR中配置参数仅用来构造启停异常场景。,7、DFX这部分这次不交付，开发建议的测试重点：3节点场景下的正常启停和2节点下的"kill -9"以及并发。,8、设计文档中5.2.4中切换流程，升主为YFS的部分，不是本SR内容。,9、YCS启停流程中的一些异常分支的构造，是否需要测试：测试只测配置参数级别的，对于其它类型的异常分支，测试这边不覆盖，由开发的ut进行覆盖。,Posted by xufanbo at 六月 08, 2023 16:27|
|---|
|  [](null)  ,2023.06.12 测试方案评审记录：,1、对于”三节点场景，不带DB的YCS启停操作和DB启停操作可并发“，不支持DB之间的启停并发，需要剔除相关用例。    
  2、对于ICS异常网络场景，可以测试重复拉起杀掉的场景；    
  3、整体网络异常场景优先级低，不阻塞特性上车；    
  4、模拟器测试场景可以砍掉。,Posted by xufanbo at 六月 12, 2023 17:24|
