Created by 杜宇轩, last modified by  李垠 on 十一月 08, 2024

SR：    [YDBRD-14044](https://jira.yasdb.com/browse/YDBRD-14044?src=confmacro)    -  支持本地配置文件  完成

##   [1. Overview（概述）](http://cod-conf.sics.com/pages/viewpage.action?pageId=72803535#1-overview%E6%A6%82%E8%BF%B0)  

YCS和YCR目前看来都有一些配置参数。这些参数都是之前做的时候设置了一定的规格，但是没有形成统一的框架，也没有进行系统的梳理，这个SR主要就做这件事。

##   [2. Features（功能特性）](http://cod-conf.sics.com/pages/viewpage.action?pageId=72803535#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

1. 写清楚哪些参数支撑在线修改
1. 哪些参数只支持通过YCR配置
1. 参数健壮性相关、参数校验（范围）
1. 要解决的bug    
    [YASCL-190](https://jira.yasdb.com/browse/YASCL-190?src=confmacro)    -  【YCS】磁阵环境下，VOTING_DISK参数的值设置为本地已存在文件，启动ycs，报错信息不合理  问题已转需求
1. 需要移植DB的参数框架。实现包括范围、重复值、默认值等参数能力。


##   [3. Interfaces（接口）](http://cod-conf.sics.com/pages/viewpage.action?pageId=72803535#3-interfaces%E6%8E%A5%E5%8F%A3)  

ycsctl set log_size value          -set ycs run log size to target size 动态修改log_size参数    
  ycsctl get log_size                   -get ycs run log size                       得到log_size参数    
  ycsctl set log_number value   -set ycs run log number to target number  动态修改log_number参数    
  ycsctl get log_number            -get ycs run log number                 得到log_number参数

ycsctl show parameter           -get all yascs config parameter                       打印得到ycs的内部参数，即yascs.ini里的参数

##   [4. Limitations（功能限制）](http://cod-conf.sics.com/pages/viewpage.action?pageId=72803535#4-limitations%E5%8A%9F%E8%83%BD%E9%99%90%E5%88%B6)  

本节只考虑ycs和ycr相关参数。

##   [5. Detail Design（详细设计）](http://cod-conf.sics.com/pages/viewpage.action?pageId=72803535#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

*方案设计的详细说明，包括但不限于方案选型、方案所依赖的技术/第三方组件的原理或背景介绍、关键技术点、方案折衷的考量、可靠性分析、兼容性分析。可以根据需要增删小节。*

###   [5.1 Architecture（架构）](http://cod-conf.sics.com/pages/viewpage.action?pageId=72803535#51-architecture%E6%9E%B6%E6%9E%84)  

*说明方案的总体架构，优先考虑通过架构图进行描述。 *

原有DB有实现一套参数配置的框架。但是较为复杂。需要看移植的工作量大不大。

我自己之前也实现过一个简单的参数框架，看看这个框架能不能实现我们现在和未来的需求。

#### 5.1.1 现有DB的配置参数框架

  [共享集群配置参数复用DB配置参数框架代价调研](https://conf.yasdb.com/pages/viewpage.action?pageId=119540306)  

选择此方法，进行移植。

#### 5.1.2 我目前已经实现的配置参数框架

总体分为三段走。

##### 5.1.2.1 ycsSetParamValueFront

这部分优先把一些有默认值的参数先设置一个非法值（一般是超出实际范围的该参数的该参数的最大值）

> profile->autoStart = UNINITIALIZED_AUTO_START;    
  profile->restartTimes = DEFAULT_FRONT_RESTART_TIMES;    
  profile->stopStep = DEFAULT_FRONT_STOP_STEP_S;    
  profile->logSize = DEFAULT_FRONT_RUN_LOG_SIZE;    
  profile->logNumber = DEFAULT_FRONT_RUN_LOG_NUMBER;

这些参数都是特定的宏，统一放在一个地方管理。

##### 5.1.2.2 ycsSetParamValue

根据解析config文件，得到一系列key和value。

若是有默认值的参数。一般按三步走。

1. 校验是否为前面设置的非法值，如果不是，则直接报错，ini里的某参数重复。
1. 把text值转为合法的需要的类型。
1. 校验这个值，是否是符合期望的值域。


##### 5.1.2.3 ycsSetDefaultParamValue

检查有默认值的参数。如果参数目前还是第一步设置的非法值，说明没有走第二步，那么则设置上它的默认值。

> if (profile->autoStart == UNINITIALIZED_AUTO_START) {    
  profile->autoStart = ALWAYS_AUTO_START;    
  }    
  if (profile->restartTimes == DEFAULT_FRONT_RESTART_TIMES) {    
  profile->restartTimes = DEFAULT_RESTART_TIMES;    
  }    
  if (profile->stopStep == DEFAULT_FRONT_STOP_STEP_S) {    
  profile->stopStep = DEFAULT_STOP_STEP_S;    
  }    
  if (profile->logSize == DEFAULT_FRONT_RUN_LOG_SIZE) {    
  profile->logSize = DEFAULT_RUN_LOG_SIZE;    
  }    
  if (profile->logNumber == DEFAULT_FRONT_RUN_LOG_NUMBER) {    
  profile->logNumber = DEFAULT_RUN_LOG_NUMBER;    
  }

这些参数都是特定的宏，统一放在一个地方管理。和第一部分参数的宏一起。

#### 5.1.3 改造后的YCS参数配置方法

  [共享集群添加参数方法](https://conf.yasdb.com/pages/viewpage.action?pageId=122066638)  

###   [5.2 Data Structures & Flow（数据结构与流程）](http://cod-conf.sics.com/pages/viewpage.action?pageId=72803535#52-data-structures--flow%E6%95%B0%E6%8D%AE%E7%BB%93%E6%9E%84%E4%B8%8E%E6%B5%81%E7%A8%8B)  

*设计主要数据结构、工作流程、序列图等。*

#### 5.2.1 梳理的参数信息

  [共享集群的本地配置参数梳理](https://conf.yasdb.com/pages/viewpage.action?pageId=118588297)  

#### 5.2.2 需要额外讨论的问题

voting_disk和ycr_disk的磁盘路径有效性校验问题。

1.现在voting_disk非法值的问题。

ycs那部分报错：

YCS-05605 ycs throw an exception, id:2, msg:cluster separated    
  YAS-00406 connection is closed.

模拟器会core，且报错：

SIMS-05512, DEV5 is an invalid disk/directory/file name.

2.ycr_disk非法值的问题

ycs那部分报错：

YCS-05625 failed to check ycs profile, reason: YCR_DISK error!.

模拟器不会core。没有任何报错，在参数设置阶段就被拦截。

##   [6. Testcases（自测用例）](http://cod-conf.sics.com/pages/viewpage.action?pageId=72803535#6-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

*设计开发人员自测用例（文字描述）。*

在启动YCS的时候，设置边界，超出边界，小于边界的参数，观察情况。

1. 恰好在边界值，启动成功。
1. 恰好超出边界值，启动失败，报错参数有误。
1. 恰好略低于边界值，启动成功。
1. 针对一些有实际意义的参数，根据具体情况观察参数和实际表现是否一致。如LOG_LEVEL。


##   [7. Workload（工作量）](http://cod-conf.sics.com/pages/viewpage.action?pageId=72803535#7-workload%E5%B7%A5%E4%BD%9C%E9%87%8F)  

*评估代码量KLOC、工作量7（人天）。*

##   [8. TODO（遗留问题）](http://cod-conf.sics.com/pages/viewpage.action?pageId=72803535#8-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

## Attachments:

[image2023-7-14_17-57-8.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMTc4OTcwYzJhZjRmNTIwMTdmIiwicmVmX2lkIjoiNjczOTZiMTc1OTNmOTljOWZmMjM1ZTE2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwODg1LCJleHAiOjE3ODIzNzcyODV9.KOqV3JlzZFLE2X5_0I5fyUDx7ng6Hxz6eDEbMZnImN4)

 (image/png)    


## Comments:

|  [](null)  ,1.权限的东西OM做更合适。,2.如果配的不对，操作系统的报错看看能不能报出来。YCS这层。,3.磁盘的大小，包括实际磁盘的大小和配置文件里磁盘的大小是否匹配。,4.接3，YCR的100M可以认为是最小的配置要求。在读盘之后检查是不是比最小配置更大。OM也可以做，双重保护。,5.获取盘的大小的接口可以找YFS请教下。,6.network timeout的参数也要加上。,7._MONITORSWITCH和_HOSTNAME中间加下划线。,8.OM要检验每台机器上配置的YCR_DISK和VOTING_DISK往同一个地方读写。,9.OM要校验yascs/yasfs inter connect URL是否可以连通。,10.ycsctl show params .ini里所有写到内存里的参数，都打印。,Posted by duyuxuan at 七月 03, 2023 17:03|
|---|
|  [](null)  ,权限不够、大小不够、不同节点之间的路径问题。这些都移交OM层做了。YCS这层检查不了。,Posted by duyuxuan at 七月 17, 2023 17:02|
