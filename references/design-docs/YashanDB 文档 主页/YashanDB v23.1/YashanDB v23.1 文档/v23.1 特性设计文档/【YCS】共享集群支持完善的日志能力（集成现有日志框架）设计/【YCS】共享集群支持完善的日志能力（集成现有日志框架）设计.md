Created by 杜宇轩, last modified by  李垠 on 十一月 08, 2024

## SR：    [YDBRD-15218](https://jira.yasdb.com/browse/YDBRD-15218?src=confmacro)    -  【共享集群】支持完善的日志能力（集成现有日志框架）  完成

##   [1. Overview（概述）](http://cod-conf.sics.com/pages/viewpage.action?pageId=72803535#1-overview%E6%A6%82%E8%BF%B0)  

现在的ycs日志做的比较粗糙。就直接是放在YASCS_HOME下的，没有日志规划，也没有其他的日志（比如alert、start.log等），所以需要规划完善，向DB看齐。

同时，现在的日志等级只支持在配置文件配置，需要支持在线修改日志等级。

##   [2. Features（功能特性）](http://cod-conf.sics.com/pages/viewpage.action?pageId=72803535#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

1. 日志等级支持在线修改
1. 日志目录规划


##   [3. Interfaces（接口）](http://cod-conf.sics.com/pages/viewpage.action?pageId=72803535#3-interfaces%E6%8E%A5%E5%8F%A3)  

修改等级的入口是ycsctl工具。

1. ycsctl get log_level ---从内存里得到log_level的真实等级
1. ycsctl set log_level "INFO"/"DEBUG"/等  ---修改日志等级，修改内存，及修改配置文件（通过.bak文件替换，防止中途失败）


##   [4. Limitations（功能限制）](http://cod-conf.sics.com/pages/viewpage.action?pageId=72803535#4-limitations%E5%8A%9F%E8%83%BD%E9%99%90%E5%88%B6)  

本节只考虑ycs的日志相关，其他的日志均不在考虑范围。

##   [5. Detail Design（详细设计）](http://cod-conf.sics.com/pages/viewpage.action?pageId=72803535#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

*方案设计的详细说明，包括但不限于方案选型、方案所依赖的技术/第三方组件的原理或背景介绍、关键技术点、方案折衷的考量、可靠性分析、兼容性分析。可以根据需要增删小节。*

###   [5.1 Architecture（架构）](http://cod-conf.sics.com/pages/viewpage.action?pageId=72803535#51-architecture%E6%9E%B6%E6%9E%84)  

*说明方案的总体架构，优先考虑通过架构图进行描述。*

不管是对内部资源的监控还是对DB的监控，都是通过内部线程来实现的。

#### 5.1.1 Oracle rac的日志目录结构借鉴

![](https://pingcode.yasdb.com/atlas/files/public/67396b11a1ad9a3311dc7fad/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQkFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUNBQUFBQUFBQUFBQUFCQUFJQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTA3MzQsImV4cCI6MTc4MjMwMTUzNH0.vTqe_Xi-Z2wUweOcwjPvi33YSRMz1Ave_4kgn9Wmzjs)

这里可以看出oracle的嵌套层级还是很深的。我们的设计我不希望有这么深的嵌套。

#### 5.1.2 我们的DB的日志目录架构

![](https://pingcode.yasdb.com/atlas/files/public/67396b118970c2af4f520138/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQkFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUNBQUFBQUFBQUFBQUFCQUFJQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTA3MzQsImV4cCI6MTc4MjMwMTUzNH0.vTqe_Xi-Z2wUweOcwjPvi33YSRMz1Ave_4kgn9Wmzjs)

上层就是log目录。在节点目录之内。

#### 5.1.3 我们的YCS的日志目录架构

参考我们的DB的日志目录架构去做即可。

slow log是针对SQL语句的执行速度的概念。这个主要是针对一些DB语句的执行速度，应该没有必要。

alert指的是告警日志，这个应该是有必要的。--需要

audit指的是审计日志，这个日志主要是审计DB的操作内容的日志。这个应该也不需要。

external这个是  代理程序日志，记录了外置UDF代理程序服务运行产生的轨迹信息、调试信息、状态变迁、未产生影响的潜在问题和直接的错误信息。这个应该也不需要。

listener这个是监听日志，主要是可以提供一些连接的信息。这个是可以做的。--不需要

run，运行日志自然不用说。肯定得要。--需要

trace，这个似乎DB也没有怎么用，没找到资料。

start.log，启动日志，把启动阶段的一些DB报出来的信息重定向进日志。ycs可以效仿。–不需要

#### 5.1.4 YCS的日志目录架构

node0(YASCS_HOME)

-----log

----------run

--------------- run.log

----------alert

--------------- alert.log

###   [5.2 Data Structures & Flow（数据结构与流程）](http://cod-conf.sics.com/pages/viewpage.action?pageId=72803535#52-data-structures--flow%E6%95%B0%E6%8D%AE%E7%BB%93%E6%9E%84%E4%B8%8E%E6%B5%81%E7%A8%8B)  

*设计主要数据结构、工作流程、序列图等。*

#### 5.1.1 在线修改日志等级方法（二选一）

1. 用户修改config文件后，通过工具命令进行重载。这种办法别的配置信息也能重载
1. 只修改日志等级 修改内存，及修改配置文件（通过.bak文件替换，防止中途失败）


选择第二种。支持ycsctl set log_level “INFO”和 ycsctl get log_level。前者是在线修改日志等级，后者是得到内存里的现在的日志等级。

#### 5.2.2 现阶段考虑增加的日志

日志规划是一方面。实际这个阶段要考虑加的日志，应该还是和实例更加相关的alert和run。

目前的DB，这些日志都是随Instance的启动而启动的，每一个日志都是有一个独立的模块。

理论上来说，移植来接口即可：aniInitAlert。

当然，本SR的内容主要是规划目录内容，创建文件夹，实际移植操作可能需要后续来承载。

##   [6. Testcases（自测用例）](http://cod-conf.sics.com/pages/viewpage.action?pageId=72803535#6-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

*设计开发人员自测用例（文字描述）。*

1. 根据日志目录规划，看SR完成之后的Log目录是否满足。
1. 看在线修改日志等级之后的日志是否符合等级修改的结果。
1. 考虑异常场景（修改到一半掉电、参数格式有误）


  


##   [7. Workload（工作量）](http://cod-conf.sics.com/pages/viewpage.action?pageId=72803535#7-workload%E5%B7%A5%E4%BD%9C%E9%87%8F)  

*评估代码量KLOC、工作量2（人天）。*

##   [8. TODO（遗留问题）](http://cod-conf.sics.com/pages/viewpage.action?pageId=72803535#8-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

  


## Attachments:

[image2023-6-5_9-28-55.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMTBhMWFkOWEzMzExZGM3ZmFhIiwicmVmX2lkIjoiNjczOTZiMTA1OTNmOTljOWZmMjM1ZDkyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNzM0LCJleHAiOjE3ODIzNzcxMzR9.0K3DE00sfEfyojsX63Fn1oUml9G3q5Fq7Em1RWM-Hpo)

 (image/png)    


[image2023-6-1_15-46-54.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMTA4OTcwYzJhZjRmNTIwMTM2IiwicmVmX2lkIjoiNjczOTZiMTA1OTNmOTljOWZmMjM1ZDkyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNzM0LCJleHAiOjE3ODIzNzcxMzR9.dQsV7HEkKE4bWbd3vSbYRty8NwdjNbXAW49-sJArVqU)

 (image/png)    


[image2023-6-1_11-58-46.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMTE4OTcwYzJhZjRmNTIwMTM3IiwicmVmX2lkIjoiNjczOTZiMTA1OTNmOTljOWZmMjM1ZDkyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNzM0LCJleHAiOjE3ODIzNzcxMzR9.HUpxzrGKI9zyKh499mqmxLJBF9Bz2fLdotXyqiqa3lE)

 (image/png)    


[image2023-6-1_11-23-12.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMTFhMWFkOWEzMzExZGM3ZmFjIiwicmVmX2lkIjoiNjczOTZiMTA1OTNmOTljOWZmMjM1ZDkyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNzM0LCJleHAiOjE3ODIzNzcxMzR9.x2n0mi2siKgNJ7-FucsuIcRR97KqXAH9H45ndCxPjVY)

 (image/png)    
