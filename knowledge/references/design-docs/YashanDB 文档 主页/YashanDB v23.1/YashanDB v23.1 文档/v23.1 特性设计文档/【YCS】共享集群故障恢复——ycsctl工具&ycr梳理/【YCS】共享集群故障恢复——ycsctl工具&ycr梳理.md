Created by 杜宇轩, last modified by  李垠 on 十一月 08, 2024

JIRA：    [YDBRD-15388](https://jira.yasdb.com/browse/YDBRD-15388?src=confmacro)    -  【共享集群】故障恢复——ycsctl客户端(包含ycr流程）  完成

##   [1. Overview（概述）](https://conf.yasdb.com/pages/viewpage.action?pageId=119558688#1-overview%E6%A6%82%E8%BF%B0)  

本文档描述共享集群软件中集群管理模块YASCS系统对于ycsctl工具&ycr梳理这块的异常梳理与恢复

异常： 1.环境异常 2.配置文件异常 3.键入命令异常 4.YCR命令异常

根据上述异常而触发YASCS软件整体的异常流程处理。

参考文献：[YASDB故障模式库-共享集群]       [https://conf.yasdb.com/pages/viewpage.action?pageId=104221906](https://conf.yasdb.com/pages/viewpage.action?pageId=104221906)  

##   [2. Features（功能特性）](https://conf.yasdb.com/pages/viewpage.action?pageId=119558688#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

*说明本方案的功能特性。*

通过埋点等手段模拟监控运行过程中可能遇到的异常场景以及观察集群是否能有有效手段去处理这些异常。

##   [3. Interfaces（接口）](https://conf.yasdb.com/pages/viewpage.action?pageId=119558688#3-interfaces%E6%8E%A5%E5%8F%A3)  

*列出本方案对外提供的接口、配置参数、API等。*

无新增接口

##   [4. Limitations（功能限制）](https://conf.yasdb.com/pages/viewpage.action?pageId=119558688#4-limitations%E5%8A%9F%E8%83%BD%E9%99%90%E5%88%B6)  

*说明本方案对外的功能限制或约束。*

仅针对YCS实例运行中的对于ycsctl工具&ycr这块的异常处理流程。

##   [5. Detail Design（详细设计）](https://conf.yasdb.com/pages/viewpage.action?pageId=119558688#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

###   [5.1 Architecture（架构）](https://conf.yasdb.com/pages/viewpage.action?pageId=119558688#51-architecture%E6%9E%B6%E6%9E%84)  

*说明方案的总体架构，优先考虑通过架构图进行描述。*

  
  ycsctl工具流程里的故障主要是和服务端通讯这块。

YCR的故障的入口是在ycsctl工具命令处理之中的。YCR方面的故障主要从命令方面进行梳理。

###   [5.2 Data Structures & Flow（数据结构与流程）](https://conf.yasdb.com/pages/viewpage.action?pageId=119558688#52-data-structures--flow%E6%95%B0%E6%8D%AE%E7%BB%93%E6%9E%84%E4%B8%8E%E6%B5%81%E7%A8%8B)  

*设计主要数据结构、工作流程、序列图等。*

#### 5.2.1 ycsctl工具流程异常

ycsctl工具自身存在的异常主要是需求的环境、配置文件以及输入的命令产生的异常。

|故障分类|故障子类|故障名称|故障检测|故障定位|故障原因|故障修复|影响范围（可选）|故障预防（可选）|故障注入（测试）|是否落需求|
|---|---|---|---|---|---|---|---|---|---|---|
|工具流程client侧|ycsctlConnect失败（握手）|ycscAllocContext分配内存失败|  
|使用命令时会报错|  
|  
|  
|  
|ycscAllocContext埋点失败|埋点YCS_TOOL_FAULT_POINT_1,生效：ycs相关所有命令，不含ycr|
|  
|ycscConnect失败（握手）|doConnect连接失败|  
|使用命令时会报错|  
|  
|  
|  
|csConnect、processShakingMessage埋点失败|埋点YCS_TOOL_FAULT_POINT_2、YCS_TOOL_FAULT_POINT_3,生效：ycs相关所有命令，不含ycr|
|  
|ycscSendPacket失败|发送信息失败|  
|使用命令时会报错|  
|  
|  
|  
|ycscSendPacket埋点失败|埋点YCS_TOOL_FAULT_POINT_4,生效：get/set等命令|
|  
|ycscRecvPacket失败|接收信息失败|  
|使用命令时会报错|  
|  
|  
|  
|ycscRecvPacket埋点失败|埋点YCS_TOOL_FAULT_POINT_5,生效：get/set等命令|
|  
|收到的消息长度不对，有可能是新旧代码版本不对。|异常情况，长度不对|  
|使用命令时会报错|  
|  
|  
|  
|埋点让数据包格式有问题|埋点YCS_TOOL_FAULT_POINT_12,生效：set log_levcel "AAA"|
|  
|yascs.ipc文件故障|连接uds文件有问题，拿不到权限或者不存在|  
|使用命令时会报错|  
|  
|  
|  
|删除yascs.ipc文件|  
|
|工具流程server侧|csWaitForRecv失败（握手）|等待接收消息包失败|  
|会打日志，客户端收不到回应消息会报错|  
|  
|  
|  
|csWaitForRecv直接埋点失败|埋点YCS_TOOL_FAULT_POINT_6,ycs相关所有命令，不含ycr|
|  
|csRecvBytes失败（握手）|接收消息失败|  
|会打日志，客户端收不到回应消息会报错|  
|  
|  
|  
|csRecvBytes直接埋点失败|埋点YCS_TOOL_FAULT_POINT_7,ycs相关所有命令，不含ycr|
|  
|ycsGetResource失败（握手）|ycs上获取用于命令使用的资源失败|  
|会打日志，客户端收不到回应消息会报错|  
|  
|  
|  
|codSysAlloc埋点失败。|埋点YCS_TOOL_FAULT_POINT_8,ycs相关所有命令，不含ycr|
|  
|ycsGetToolItem失败（握手）|获取资源失败|  
|会打日志，客户端收不到回应消息会报错|  
|  
|  
|  
|ycsGetToolItem直接埋点失败|埋点YCS_TOOL_FAULT_POINT_9,get/set等命令|
|  
|codStartThreadDetached失败|启动线程失败|  
|会打日志，客户端收不到回应消息会报错|  
|  
|  
|  
|codStartThreadDetached埋点失败|埋点YCS_TOOL_FAULT_POINT_10,get/set等命令|
|  
|ycsProcessIpcMessage失败|ycsProcessClientTool失败|  
|直接报错|  
|  
|  
|  
|具体参数具体分析，以其中set param为例，尝试篡改数据包的大小，看能否返回协议的报错。|埋点YCS_TOOL_FAULT_POINT_11,set log_levcel "AAA"|


#### 5.2.2 ycr异常

YCR的入口在ycsctl里，根据不同的命令存在不同的问题。

目前在一个功能里若干异常分支入口都是相同的函数，需要对整一条链条上的函数进行埋点。针对函数里可能存在的异常分支单独埋点进行验证。

|故障分类|故障子类|故障名称|故障检测|故障定位|故障原因|故障修复|影响范围（可选）|故障预防（可选）|故障注入（测试）|是否落需求|
|---|---|---|---|---|---|---|---|---|---|---|
|YCR流程异常|create cluster异常|mallocAlign分配内存失败|  
|报错|  
|  
|  
|  
|mallocAlign埋点失败|埋点YCS_YCR_FAULT_POINT_1|
|  
|  
|ycsLockDisk失败|  
|报错|  
|  
|  
|  
|ycsLockDisk埋点失败|埋点YCS_YCR_FAULT_POINT_2|
|  
|  
|doCreateCluster失败|  
|报错|  
|  
|  
|  
|diskRead/diskWriteDual埋点失败，或者不overwrite时ycsYDiskInitialized成功，diskWriteDual埋点内容下面单独考虑。|埋点YCS_YCR_FAULT_POINT_3、,YCS_YCR_FAULT_POINT_4、,YCS_YCR_FAULT_POINT_5|
|  
|  
|ycsEnableYasfs失败|  
|报错|  
|  
|  
|  
|mallocAlign/ycsLockDisk，doEnableDefaultRes中的diskReadDual/diskWriteDual埋点失败|埋点YCS_YCR_FAULT_POINT_6、,YCS_YCR_FAULT_POINT_7、,YCS_YCR_FAULT_POINT_8、,YCS_YCR_FAULT_POINT_9|
|  
|add node异常|mallocAlign分配内存失败|  
|报错|  
|  
|  
|  
|mallocAlign埋点失败|埋点YCS_YCR_FAULT_POINT_10|
|  
|  
|ycsLockDisk失败|  
|报错|  
|  
|  
|  
|ycsLockDisk埋点失败|埋点YCS_YCR_FAULT_POINT_11|
|  
|  
|doAddNode失败|  
|报错|  
|  
|  
|  
|diskReadDual/diskWriteDual埋点失败|埋点YCS_YCR_FAULT_POINT_12、,YCS_YCR_FAULT_POINT_13|
|  
|add yasdbinstance异常|mallocAlign分配内存失败|  
|报错|  
|  
|  
|  
|mallocAlign埋点失败|埋点YCS_YCR_FAULT_POINT_14|
|  
|  
|ycsLockDisk失败|  
|报错|  
|  
|  
|  
|ycsLockDisk埋点失败|埋点YCS_YCR_FAULT_POINT_15|
|  
|  
|doAddYasdbInstance失败|  
|报错|  
|  
|  
|  
|diskReadDual/diskWriteDual埋点失败|埋点YCS_YCR_FAULT_POINT_16、,YCS_YCR_FAULT_POINT_17|
|  
|show config失败|mallocAlign分配内存失败|  
|报错|  
|  
|  
|  
|mallocAlign埋点失败|埋点YCS_YCR_FAULT_POINT_18|
|  
|  
|ycsLoadYcr失败|  
|报错|  
|  
|  
|  
|ycsLockDisk/diskRead/ycsYDiskInitialized埋点失败|埋点YCS_YCR_FAULT_POINT_19、,YCS_YCR_FAULT_POINT_20|
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|


###   [5.3 Compatibility（兼容性）](https://conf.yasdb.com/pages/viewpage.action?pageId=119558688#53-compatibility%E5%85%BC%E5%AE%B9%E6%80%A7)  

*说明设计方案对兼容性的影响，如果影响了兼容性，则需要给出详细的兼容性方案设计*

##   [6. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=119558688#6-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

###   [6.1 不带业务场景](https://conf.yasdb.com/pages/viewpage.action?pageId=119558688#61-%E4%B8%8D%E5%B8%A6%E4%B8%9A%E5%8A%A1%E5%9C%BA%E6%99%AF)  

#### 6.1.1 仅ycsctl内容

|用例名称|用例步骤描述|期望|实际结果|备注|
|:---|:---|:---|:---|:---|
|ycsctlConnect失败（握手）|ycscAllocContext埋点失败|使用命令时会报错|不core，下同|埋点YCS_TOOL_FAULT_POINT_1,ycs相关所有命令，不含ycr|
|ycscConnect失败（握手）|csConnect埋点失败|使用命令时会报错|  
|埋点YCS_TOOL_FAULT_POINT_2,ycs相关所有命令，不含ycr|
|  
|processShakingMessage埋点失败|使用命令时会报错|  
|埋点YCS_TOOL_FAULT_POINT_3,ycs相关所有命令，不含ycr|
|ycscSendPacket失败|ycscSendPacket埋点失败|使用命令时会报错|  
|埋点YCS_TOOL_FAULT_POINT_4,get/set等命令|
|ycscRecvPacket失败|ycscRecvPacket埋点失败|使用命令时会报错|  
|埋点YCS_TOOL_FAULT_POINT_5,get/set等命令|
|收到的消息长度不对，有可能是新旧代码版本不对。|埋点让数据包格式有问题|使用命令时会报错|  
|埋点YCS_TOOL_FAULT_POINT_12,set log_levcel "AAA"|
|yascs.ipc文件故障|删除yascs.ipc文件|使用命令时会报错|  
|  
|
|csWaitForRecv失败（握手）|csWaitForRecv直接埋点失败|会打日志，客户端收不到回应消息会超时报错|  
|埋点YCS_TOOL_FAULT_POINT_6,ycs相关所有命令，不含ycr|
|csRecvBytes失败（握手）|csRecvBytes直接埋点失败|会打日志，客户端收不到回应消息会超时报错|  
|埋点YCS_TOOL_FAULT_POINT_7,ycs相关所有命令，不含ycr|
|ycsGetResource失败（握手）|codSysAlloc埋点失败|会打日志，客户端收不到回应消息会超时报错|  
|埋点YCS_TOOL_FAULT_POINT_8,ycs相关所有命令，不含ycr|
|  
|ycsGetToolItem埋点失败|会打日志，客户端收不到回应消息会超时报错|  
|埋点YCS_TOOL_FAULT_POINT_9,get/set等命令|
|codStartThreadDetached失败|codStartThreadDetached埋点失败|会打日志，客户端收不到回应消息会超时报错|  
|埋点YCS_TOOL_FAULT_POINT_10,get/set等命令|
|ycsProcessIpcMessage失败|具体参数具体分析，以其中set param为例，尝试篡改数据包的大小，看能否返回协议的报错。|使用命令时会报错|  
|埋点YCS_TOOL_FAULT_POINT_11,set log_levcel "AAA"|
|  
|  
|  
|  
|  
|
|  
|  
|  
|  
|  
|


#### 6.1.2 ycr内容

|用例名称|用例步骤描述|期望|实际结果|备注|
|:---|:---|:---|:---|:---|
|create cluster时分配内存失败|mallocAlign埋点失败|使用命令报错|正常打印，无core，下同|埋点YCS_YCR_FAULT_POINT_1|
|create cluster时ycsLockDisk失败|ycsLockDisk埋点失败|使用命令报错|  
|埋点YCS_YCR_FAULT_POINT_2|
|create cluster时doCreateCluster失败|diskRead埋点失败|使用命令报错|  
|埋点YCS_YCR_FAULT_POINT_3|
|  
|不overwrite时ycsYDiskInitialized成功|使用命令报错|  
|埋点YCS_YCR_FAULT_POINT_4|
|  
|diskWriteDual埋点失败|使用命令报错|  
|埋点YCS_YCR_FAULT_POINT_5|
|create cluster时ycsEnableYasfs失败|mallocAlign埋点失败|使用命令报错|  
|埋点YCS_YCR_FAULT_POINT_6|
|  
|ycsLockDisk埋点失败|使用命令报错|  
|埋点YCS_YCR_FAULT_POINT_7|
|doEnableDefaultRes埋点失败|diskReadDual埋点失败|使用命令报错|  
|埋点YCS_YCR_FAULT_POINT_8|
|  
|diskWriteDual埋点失败|使用命令报错|  
|埋点YCS_YCR_FAULT_POINT_9|
|  
|  
|  
|  
|  
|
|add node时分配内存失败|mallocAlign埋点失败|使用命令报错|  
|埋点YCS_YCR_FAULT_POINT_10|
|add node时ycsLockDisk失败|ycsLockDisk埋点失败|使用命令报错|  
|埋点YCS_YCR_FAULT_POINT_11|
|add node时doAddNode失败|diskReadDual埋点失败|使用命令报错|  
|埋点YCS_YCR_FAULT_POINT_12|
|  
|diskWriteDual埋点失败|使用命令报错|  
|埋点YCS_YCR_FAULT_POINT_13|
|  
|  
|  
|  
|  
|
|add yasdbinstance  时分配内存失败|mallocAlign埋点失败|使用命令报错|  
|埋点YCS_YCR_FAULT_POINT_14|
|add yasdbinstance  时ycsLockDisk失败|ycsLockDisk埋点失败|使用命令报错|  
|埋点YCS_YCR_FAULT_POINT_15|
|add yasdbinstance  时doAddYasdbInstance失败|diskReadDual埋点失败|使用命令报错|  
|埋点YCS_YCR_FAULT_POINT_16|
|  
|diskWriteDual埋点失败|使用命令报错|  
|埋点YCS_YCR_FAULT_POINT_17|
|  
|  
|  
|  
|  
|
|show config时分配内存失败|mallocAlign埋点失败|使用命令报错|  
|埋点YCS_YCR_FAULT_POINT_18|
|show config时ycsLoadYcr埋点失败|ycsLockDisk埋点失败|使用命令报错|  
|埋点YCS_YCR_FAULT_POINT_19|
|  
|diskRead埋点失败|使用命令报错|  
|埋点YCS_YCR_FAULT_POINT_20|


  


##   [7. Document（资料）](https://conf.yasdb.com/pages/viewpage.action?pageId=119558688#7-document%E8%B5%84%E6%96%99)  

##   [8. Workload（工作量）](https://conf.yasdb.com/pages/viewpage.action?pageId=119558688#8-workload%E5%B7%A5%E4%BD%9C%E9%87%8F)  

*评估代码量KLOC、工作量2开发+2验证（人天）。*

##   [9. TODO（遗留问题）](https://conf.yasdb.com/pages/viewpage.action?pageId=119558688#9-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

*说明本方案遗留的问题或下一步需要解决的问题。*

## Comments:

|  [](null)  ,1.工具和服务端之间的异常也要考虑。,2.  ycsLockDisk是否存在并发抢锁或者等待超时，考虑在加锁这里hang住或者core掉新起一次命令。,3.ycsctl连接资源耗尽、通讯失败的问题。,Posted by duyuxuan at 七月 28, 2023 17:16|
|---|
