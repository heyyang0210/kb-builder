Created by 杜宇轩, last modified by  李垠 on 十一月 08, 2024

SR：       [YDBRD-21390](https://jira.yasdb.com/browse/YDBRD-21390?src=confmacro)    -  YCS支持动态参数修改  验证中

##   [1. Overview（概述）](http://cod-conf.sics.com/pages/viewpage.action?pageId=72803535#1-overview%E6%A6%82%E8%BF%B0)  

###   [1.1 需求来源](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#11-%E9%9C%80%E6%B1%82%E6%9D%A5%E6%BA%90)  

YCS的配置参数之前只有部分支持在线修改。有的参数就只能重启设置，不是很方便，所以需求YCS去把能够修改的参数都支持在线的修改。

###   [1.2 调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#12-%E8%B0%83%E7%A0%94%E6%96%87%E6%A1%A3)  

参数之前设计的时候已经调研过友商，这回只是增加了部分参数可以修改的接口。无需调研。

###   [1.3 需求分析](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#13-%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|:---|:---|:---|:---|:---|
|功能|修改参数配置|通过工具ycsctl，发送命令给服务端修改完成|是|是|
|功能|查看参数配置|通过工具ycsctl，发送命令给服务端查看内存并发回给工具打印/通过查看yascs.ini|是|是|
|性能|/|  
|否|否|
|可用性|/|----|否|否|
|可靠性|/|----|否|否|
|可维可测|修改边界值、无效值等|增加边界值判断，报错|是|是|
|安全|/|----|否|否|
|易用性|便于用户使用命令|可以通过工具help查看|是|是|
|可修改性|----|----|否|否|
|兼容性|----|----|否|否|
|周边配合|/|----|----|否|
|周边配合|/|----|----|否|
|周边配合|/|----|----|否|


  


##   [2. Features（功能特性）](http://cod-conf.sics.com/pages/viewpage.action?pageId=72803535#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

1. 写清楚哪些参数支持在线修改
1. 在线修改的参数部分可能存在约束，需要说明
1. 包括监控开关的参数最好也支持在线修改 


##   [3. Interfaces（接口）](http://cod-conf.sics.com/pages/viewpage.action?pageId=72803535#3-interfaces%E6%8E%A5%E5%8F%A3)  

接口主要在工具侧。

ycsctl set xxx value             动态修改xxx参数    
  ycsctl get xxx                      得到xxx参数

ycsctl show parameter        -get all yascs config parameter                       打印得到ycs的内部参数，即yascs.ini里的参数

##   [4. Limitations（功能限制）](http://cod-conf.sics.com/pages/viewpage.action?pageId=72803535#4-limitations%E5%8A%9F%E8%83%BD%E9%99%90%E5%88%B6)  

部分参数的修改有约束条件。详见5.2.1

##   [5. Detail Design（详细设计）](http://cod-conf.sics.com/pages/viewpage.action?pageId=72803535#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

*方案设计的详细说明，包括但不限于方案选型、方案所依赖的技术/第三方组件的原理或背景介绍、关键技术点、方案折衷的考量、可靠性分析、兼容性分析。可以根据需要增删小节。*

###   [5.1 Architecture（架构）](http://cod-conf.sics.com/pages/viewpage.action?pageId=72803535#51-architecture%E6%9E%B6%E6%9E%84)  

*说明方案的总体架构，优先考虑通过架构图进行描述。 *

原有的参数修改框架基本可以支撑得起修改部分的功能。

主要需要增加命令以及修改的时候需要注意参数的配置范围，需要及时报错。

#### 5.1.1 现有的参数还需要支持在线修改以及查看的命令

##### 5.1.1.1 RESTART_TIMES

修改命令：ycsctl set RESTART_TIMES value

查看命令：ycsctl get RESTART_TIMES

##### 5.1.1.2  STOP_STEP->更换为RESTART_INTERVAL

修改命令：ycsctl set RESTART_INTERVAL value

查看命令：ycsctl get RESTART_INTERVAL

##### 5.1.1.3 AUTO_START

修改命令：ycsctl set AUTO_START value

查看命令：ycsctl get AUTO_START

##### 5.1.1.4 _MONITOR_SWITCH

修改命令：ycsctl set _MONITOR_SWITCH value

##### 5.1.1.5 WAIT_STOP_FIN_TIME

修改命令：ycsctl set WAIT_STOP_FIN_TIME value

查看命令：ycsctl get WAIT_STOP_FIN_TIME 

#### 5.1.2 支持修改的参数列表与生效模式

|参数|生效模式|是否已实现|
|---|---|---|
|RESTART_TIMES|即时生效|待实现|
|RESTART_INTERVAL|即时生效|待实现|
|AUTO_START|重启生效|待实现|
|_MONITOR_SWITCH|即时生效|待实现|
|WAIT_STOP_FIN_TIME|即时生效|待实现|
|LOG_LEVEL|即时生效|已实现|
|LOG_SIZE|即时生效|已实现|
|LOG_NUMBER|即时生效|已实现|


#### 5.1.3 不支持修改的参数列表与原因

|参数|原因|
|---|---|
|NETWORK_HB_TIMEOUT|节点的该参数要保持统一，后续在YCR中做参数配置|
|DISK_HB_KEEP_ALIVE|节点的该参数要保持统一，后续在YCR中做参数配置|
|YCR_DISK|首次初始化的时候就已经确定好了固定的磁盘路径，无法修改|
|VOTING_DISK|首次初始化的时候就已经确定好了固定的磁盘路径，无法修改|


###   [5.2 Data Structures & Flow（数据结构与流程）](http://cod-conf.sics.com/pages/viewpage.action?pageId=72803535#52-data-structures--flow%E6%95%B0%E6%8D%AE%E7%BB%93%E6%9E%84%E4%B8%8E%E6%B5%81%E7%A8%8B)  

*设计主要数据结构、工作流程、序列图等。*

参数修改主要修改的是内存里的值，当被使用的时候，修改就会产生影响，所以部分参数动态修改存在约束。

#### 5.2.1 参数修改的约束定界

本节中的定界约束，不能修改的约束下修改，不会core，不保证其他。

所以功能都是通过工具来实现的，所以必须有YCS实例存活且可用，才能通过这种方式修改参数。

##### 5.2.1.1 RESTART_TIMES

该参数在DB掉线时，在资源监控中会读取使用，作为重启的次数标准。

约束为：必须在DB启动且在线的情况下修改或者是DB未启动（DB重新手动拉起生效）的情况下修改

##### 5.2.1.2  STOP_STEP->更换为RESTART_INTERVAL

该参数在DB持续掉线时，在资源监控中会读取使用，若RESTART_TIMES不为0时，作为重拉次数时的间隔标准

约束为：必须在DB启动且在线的情况下修改或者是DB未启动的情况下修改或者restartTimes=0时修改

##### 5.2.1.3 AUTO_START

该参数主要是在启动实例的时候，与resTarget这个参数绑定，作为是否要自动启动DB的一个指标。

约束为：

1.启动YCS的时候无法修改

2.执行ycsctl show parameter中无法修改

3.实际生效需要重启

##### 5.2.1.4 _MONITOR_SWITCH

该参数是用于监控的控制开关参数。监控线程存在，但在最前面根据这个参数会进行位判断，如果为1则不工作。

约束为：

1.YCS刚启动初始化时无法修改

2.网络的开关在重连或者断连事件发生时无法修改

3.DB client的开关在接收别的ycsctl命令时无法修改（修改之后无法复原，除非改参数值后重启）

该参数主要开发自测。

##### 5.2.1.5 WAIT_STOP_FIN_TIME

该参数作为强制停DB的时间标准，在停资源（主动、监控自动）时使用。

约束为：

1.在主动停资源（DB、YFS）时无法修改

#### 5.2.2 参数修改支持并发

并发设计参考ycsctl 起停的并发控制逻辑，暂定同时满足10个并发约束，同时加读写锁保障。

参数修改流程    
  1、加写锁    
  2、修改内存参数    
  3、修改配置文件    
  4、释放写锁

读取参数的流程    
  1、加读锁    
  2、读取    
  3、释放读锁

节点之间的并发是独立的。

##   [6. Testcases（自测用例）](http://cod-conf.sics.com/pages/viewpage.action?pageId=72803535#6-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

*设计开发人员自测用例（文字描述）。*

在修改参数的时候，首先是测试命令本身是否有问题：

1. 命令内容是否对的上
1. 设置参数命令的取值范围是否在约定的取值范围内，有无报错
1. 命令是否有添加help提示
1. 命令内容是否添加进资料


然后是测试命令的结果是否符合预期：

1. 恰好在边界值，设置成功。
1. 恰好超出边界值，设置失败，报错参数有误。
1. 恰好略低于边界值，设置成功。
1. 针对不同的有实际意义的参数，根据具体情况观察参数和实际表现是否一致。
1. 观察设置成功之后get与配置参数文件的值是否同步都有修改。


并发相关主要是单节点内的并发写、读，以及超出10次的时候的报错。以及节点之前并发不受影响。

##   [7. Workload（工作量）](http://cod-conf.sics.com/pages/viewpage.action?pageId=72803535#7-workload%E5%B7%A5%E4%BD%9C%E9%87%8F)  

*评估代码量KLOC、工作量4（人天）。*

##   [8. TODO（遗留问题）](http://cod-conf.sics.com/pages/viewpage.action?pageId=72803535#8-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

## Comments:

|  [](null)  ,补充一下voting disk 和ycr  disk不能修改的原因吧,  
,Posted by liyin at 十二月 08, 2023 11:18|
|---|
|  [](null)  ,补充好了,Posted by duyuxuan at 十二月 11, 2023 17:10|
|  [](null)  ,RESTART_TIMES按设计走，后续SR优化流程    [YDBRD-24201](https://jira.yasdb.com/browse/YDBRD-24201?src=confmacro)    -  YCS资源监控优化  完成,Posted by duyuxuan at 十二月 12, 2023 15:31|
|  [](null)  ,RESTART_TIMES重启生效，_MONITOR_SWITCH增加标志位取代RESTART_TIMES=0的场景。后续一起做,Posted by duyuxuan at 十二月 12, 2023 15:32|
|  [](null)  ,##### _MONITOR_SWITCH开发自测为主,Posted by duyuxuan at 十二月 12, 2023 15:36|
|  [](null)  ,如果在故障恢复流程之中，配置文件没来得及改全，可能会造成参数不一致场景。cm重启的时候调用参数load。,Posted by duyuxuan at 十二月 12, 2023 15:54|
