Created by 施新华, last modified on 二月 03, 2024

# 1. 概述

SR：    [YDBRD-21615](https://jira.yasdb.com/browse/YDBRD-21615?src=confmacro)    *-*  *OM适配yasrman集群备份恢复*  *完成*

共享集群支持yasrman备份恢复，OM进行通过  yasbak进行适配；同时分布式已支持yasrman备份恢复，此次yasbak也适配分布式，在其它需求yasbak已经适配单机。

# 2. 需求分析

## 2.1 功能点分析

- 使用yasbak进行集群，分布式备份恢复验证，同时验证单机备份恢复能力正常。
- yasbak工作流程：


         前提：数据库已经安装、执行备份服务器已解压YashanDB安装包、  具备XBSA的动态库。

         流程：  yasbak deploy进行初始化   

                                 ↓

                     yasbak run调用备份sql命令执行备份   

                                 ↓

                     yasboot cluster clean --restore重置数据库   

                                 ↓

                     yasbak run调用命令恢复数据库   

                                ↓

                    调用yasbak clean清理环境

- 验证命令：


**yasbak deploy**

本命令用于初始化yasbak和yasrman的运行环境。

|选项|含义|是否必选参数|
|:---|:---|---|
|*-c,--cluster*|指定一个名称，该名称将用于配置数据库命名，一个数据库对应一个名称，建议与yasboot部署时的名称保持一致|是|
|*-a,--addr*|指定数据库的yasom访问地址，yasbak将通过该地址与yasom进行通信|是|
|*-k,--key*|连接yasom时校验的token，需要和yasom配置保持一致|是|
|*-D,--cata-log*|yasrman所使用的cata log，将指定路径生成该目录。若未初始化，将使用yasrman进行初始化，若已初始化将忽略。|是|
|*-u,--user*|连接数据库使用的用户名，后续执行备份时默认将使用该用户|是|
|*-p,--password*|连接数据库用户对应密码，该密码将通过多次加密后保存在本地配置文件内，执行clean可以清理配置。|是|
|*-t,--cert*|当yasom指定TLS加密通信时，需要指定对应的加密证书|否|
|*-S,--server*|当yasom指定server名称后，需要指定该名称|否|


  


### yasbak run

本命令用于执行yasman的备份、恢复、清理备份等语句。

|选项|含义|是否必选参数|
|:---|:---|---|
|*-c,--cluster*|deploy时指定的cluster名称|是|
|*-s,--sql*|指定yasrman运行的SQL|是|
|*-u,--user*|执行yasrman使用的用户，若不指定将使用deploy时的用户名。|否|
|*-p,--password*|执行yasrman使用的密码，若不指定将使用deploy时的密码，yasbak解密后内部使用。|否|
|*-r,--role*|可选参数：primary、standby，使用指定类型节点进行备份操作。|否|
|*-a, --addr*|yasdb的连接地址，若提供该参数值，将指定这个节点，--role将失效|否|
|*-b,--build-all*|指定该参数，在恢复备份时是否恢复其他备节点|否|


### yasbak clean

本命令用于清理初始化时生成的配置文件、元数据信息等。

|选项|含义|是否必现参数|
|:---|:---|---|
|*-c,--cluster*|deploy时指定的cluster名称|是|
|*-f,--force*|是否进行信息确认，输入yes/no|否|
|*-p,--purge*|清理时是否同时删除 cata log目录|否|


## 2.2 应用场景

单机，分布式和共享集群备份恢复。

## 2.3 规格约束

- 适配部署模式：单机，分布式和共享集群；
- 只有通过OM管理集群可用yasbak命令。
- 共享集群备份恢复约束：


1.备份目标数据库必须在open状态下。

2.恢复必须是master role节点，且必须是nomunt状态。

3.server端可以指定备份路径为普通磁盘和YFS，client端只能指定普通磁盘。--yasrman进行覆盖

4.备集群不支持备份

# 3. 详细测试设计

## 3.1 测试设计方法

OM命令验证采用等价类；OM命令参数进行简单验证，参数已经覆盖看护。

备份恢复采用场景法验证。

## 3.2 详细测试设计

### 3.2.1 详细测试设计

**语法**

|命令类型|参数|有效等价类|无效等价类|备注|
|---|---|---|---|---|
|**yasbak deploy**|*-c,--cluster*|与部署一致|1）不存在name,2）带特殊字符串~！@￥%……&*（）|  
|
||*-a,--addr*|OM地址|1）非OM地址；,2）非法IP格式地址|  
|
||*-k,--key*|正确key|非法key值|  
|
||*-D,--cata-log*|1) 有效绝对目录,2) 缺省|1）相对目录,2）无权限目录|1）the maximum length of the catalog path is 160,2）需要指定路径|
||*-u,--user*|1）sys用户,2）创建用户|不存在用户|  
|
||*-p,--password*|对应用户密码|错误密码|  
|
||*-t,--cert*|1）不填写,2）填写正确|填写错误证书|  
|
||*-S,--server*|与yasom指定一致|与yasom指定不一致|  
|
|**yasbak run**|*-c,--cluster*|/|/|  
|
||*-s,--sql*|覆盖yasrman语法|yasrman不支持语法|  
|
||*-u,--user*|1）sys用户,2）创建用户,3）不指定，使用初始化时指定用户|不存在用户|非sys用户无法进行恢复操作|
||*-p,--password*|对应用户密码|错误密码|  
|
||*-r,--role*|primary、standby|其它字符串|  
|
||*-a, --addr*|1）主节点地址,2）备节点地址|不存在地址|  
|
||*-b,--build-all*|空值或选择此参数|  
|单机，共享集群使用此参数，分布式无论是否配置全部build|
|**yasbak clean**|*-c,--cluster*|/|/|  
|
||*-f,--force*|带-f ， 不会进行确认,不带-f，   进行信息确认，输入yes/no|  
|  
|
||*-p,--purge*|带-p ，   删除 cata log目录,不带-p， 不  删除 cata log目录|  
|  
|


### 功能场景

|部署模式|测试场景|详细描述|备注|
|---|---|---|---|
|共享集群    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
|部署|1节点，2节点，3节点，4节点|  
|
||备份    
    
    
    
    
    
    
|在数据库安装服务器执行|备份成功|
|||在远端服务器执行|备份成功|
|||指定priamry主节点进行备份|备份成功|
|||指定standby备节点进行备份|集群无standby节点，指定此参数报错：de and ce role can only be primary|
|||指定master role节点地址进行备份|备份成功|
|||指定normal role节点地址进行备份|备份成功|
|||备份归档数据|备份成功|
|||集群节点非open状态下备份|备份报错：[Node 0]YAS-02078 the database is not open|
|||集群内部分节点非open|备份报错：,![](https://pingcode.yasdb.com/atlas/files/public/67396ba18970c2af4f5205e8/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFGQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTU5NDcsImV4cCI6MTc4MjMwNjc0N30.eyT_8BKgJLYLkhr_dshmE0uF350gPSWgpu-OMi5iy60)|
|||集群内部分节点下线|指定正常节点可以备份成功|
|||sys用户进行备份|备份成功|
|||创建用户进行备份(DBA权限，无DBA权限)|DBA权限用户备份成功，无法恢复|
|||备份数据到客户端|备份成功|
|||备份数据到服务端|备份成功|
|||对接XBSA，进行远程流式备份|  
|
||恢复    
    
    
    
    
    
    
    
|master role为open状态进行恢复|恢复报错：[Node 0]YAS-02071 the database is already mounted|
|||master role为mount状态进行恢复|恢复报错|
|||master role为nomount状态进行恢复|恢复成功|
|||normal role为open状态进行恢复|  
|
|||normal role为mount状态进行恢复|  
|
|||normal role为nomount状态进行恢复|master role恢复后，normal role 执行alter database open,直接恢复normal role报错：[Node 0]YAS-02605 the current instance is not master role|
|||normal role下线|master role可以恢复成功|
|||指定master role地址进行恢复|恢复成功|
|||指定normal role地址进行恢复|[Node 0]YAS-02605 the current instance is not master role|
|||恢复所有备节点|成功|
|||备份到客户端，使用normal role备份恢复master role|恢复成功|
|||备份到server端，使用normal role备份恢复master role|部署在不同host，恢复失败，找不到备份文件|
|||恢复归档数据|恢复报错|
|||对接XBSA，进行远程流式恢复|  
|
|||在新的服务器进行恢复，非执行备份服务器|报错找不到备份文件|
||异常场景    
    
    
    
    
    
    
    
    
|备份过程节点异常|报错|
|||恢复过程节点异常|  
|
|||集群内节点状态异常进行备份|1）指定异常节点备份，报错,2）指定  正常节点备份报错，bug|
|||集群内节点已经下线进行备份|1）指定下线节点备份，报错,2）指定正常节点备份成功|
|||节点状态异常进行恢复|只有nomount状态可以恢复|
|||节点已经下线进行恢复|报错|
|||备份过程DB侧取消备份命令|观察yasbak返回信息|
|||恢复过程DB侧取消恢复命令|报错|
|||磁盘空间不足进行备份|备份报错|
|||备份服务器与数据库所在服务器网络异常，进行备份|  
|
|||磁盘空间不足进行恢复|  
|
|||备份服务器与数据库所在服务器网络异常，进行恢复|  
|
||并发|同时触发多个个yasbak备份任务|其中一个报错|
|||同时触发多个yasbak恢复任务|报错|
|分布式    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
|部署|1cn1mn2dn，3cn3mn3dn(3-2，3-3) ， 其中dn1主1备开启仲裁|关闭归档备份失败，需要打开归档才能备份|
||备份|在数据库安装服务器执行备份|成功|
||  
|在远端服务器执行备份|成功|
||  
|指定主节点进行备份 -r primary|成功|
||  
|指定备节点进行备份 -r standby|报错|
||  
|指定CN节点地址进行备份 -a|成功|
||  
|指定MN主节点地址进行备份 -a|报错|
||  
|指定MN节点地址进行备份-a|报错|
||  
|指定DN主节点地址进行备份-a|报错|
||  
|指定DN备节点地址进行备份-a|报错|
||  
|备份数据到客户端|报错|
||  
|备份数据到服务端|成功|
||  
|对接XBSA，进行远程流式备份|报错，不支持客户端备份|
||恢复    
    
    
    
    
    
    
|open状态进行恢复|报错|
|||mount状态进行恢复|报错|
|||nomount状态进行恢复|可成功|
|||指定主节点进行恢复|无效参数，分布式cluster恢复成功|
|||指定备节点进行恢复|无效参数，分布式cluster恢复成功|
|||指定CN地址进行恢复|无效参数，分布式cluster恢复成功|
|||指定MN地址进行恢复|无效参数，分布式cluster恢复成功|
|||指定DN地址进行恢复|无效参数，分布式cluster恢复成功|
|||在新的服务器进行恢复，非执行备份服务器|执行备份和恢复yasbak需要在同一台服务器，跨机无法找到备份list|
||异常场景|同上，节点异常/故障覆盖CN，MN，DN|节点状态异常，备份失败,节点状态异常，恢复失败|
||  
|节点倒换后进行恢复|恢复正常|
||扩缩容|备份后扩缩容CN，然后进行恢复|1）删除节点进行恢复，报错,2）扩缩容节点进行恢复，新扩节点不能恢复|
|||备份后扩缩容MN备节点，然后进行恢复|1）删除备份节点，恢复提示报错,2）删除非备份节点，恢复报错,3）新扩节点不能回恢复|
|||备份后扩缩容DN备节点，然后进行恢复|1）删除备份节点，恢复提示报错,2）删除非备份节点，恢复报错,3）新扩节点不能回恢复,![](https://pingcode.yasdb.com/atlas/files/public/67396ba18970c2af4f5205ea/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFGQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTU5NDcsImV4cCI6MTc4MjMwNjc0N30.eyT_8BKgJLYLkhr_dshmE0uF350gPSWgpu-OMi5iy60)|
|||备份后扩缩容DN组，然后进行恢复|1）缩容后恢复，找不到节点报错,2）扩容后恢复，不会恢复新扩节点|
||并发场景|并行备份|并发执行成功报错|
||  
|并行恢复|并发执行都报错|
|单机|部署|1节点，1主1备(开启仲裁)， 1主2备(开启自选)|  
|
|  
|备份恢复|验证基础备份恢复能力正常|  
|
|  
|扩缩容|备份后扩缩容备节点，然后进行恢复|不指定删除节点，可以恢复成功|


### 3.2.2 专项测试覆盖

|系统级DFX分类|是否涉及|说明|
|:---|:---|---|
|CT|否|  
|
|KT|否|  
|
|长稳|否|  
|
|一致性|否|  
|
|三方测试工具    
  (sqltest，sqlancer)|否|  
|
|安全|否|  
|
|DFR|是|验证节点异常，外部故障注入场景下备份恢复|
|HA|否|  
|
|压力|否|  
|
|性能|否|  
|
|可维护性|是|OM命令提示信息可读性|


  


# 4. 测试用例

# 5. 测试框架设计

    已经测试框架，可添加测试用例。

# 6. 测试环境说明

需要覆盖X86，arm环境。

# 7. 工作量评估

工作量：1人/周

计划测试完成时间：

## Attachments:

[OM适配yasrman备份恢复测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYTBhMWFkOWEzMzExZGM4NDVjIiwicmVmX2lkIjoiNjczOTZiYTA1OTNmOTljOWZmMjM2NTA4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1OTQ3LCJleHAiOjE3ODIzODIzNDd9.quc6Oh72fo81GkpF1nKmxF9nQhGwN3ygPTTYE1HbtVo)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


## Comments:

|  [](null)  ,评审设计参与者：施新华，李世铭，高亚宁，瞿蓝孟，梁雄,会议纪要：    
  1）确认yasbak deploy命令中--server参数如何使用 @梁雄     
  2）补充执行yasrman支持语法，抛出的异常yasbak提示信息合理    
  3）共享集群增加归档备份，归档恢复    
  4）分别在不同的服务器执行备份、恢复    
  5）yasbak下发命令后，DB侧取消，观察yasbak提示信息    
  6）分布式备份能力此次未增强，与原有能力保持一致,Posted by shixinhua at 一月 26, 2024 10:48|
|---|
