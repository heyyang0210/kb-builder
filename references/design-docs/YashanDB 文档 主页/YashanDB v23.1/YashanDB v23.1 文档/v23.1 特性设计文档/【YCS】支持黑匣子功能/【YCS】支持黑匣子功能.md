Created by 杜宇轩, last modified by  李垠 on 十一月 08, 2024

SR：    [YDBRD-15219](https://jira.yasdb.com/browse/YDBRD-15219?src=confmacro)    -  【共享集群】支持黑匣子功能  完成

##   [1. Overview（概述）](http://cod-conf.sics.com/pages/viewpage.action?pageId=72803535#1-overview%E6%A6%82%E8%BF%B0)  

现在DB这块是有黑匣子的能力的，这块能力需要移植到YCS上，需要看一下如何支持这个功能。

##   [2. Features（功能特性）](http://cod-conf.sics.com/pages/viewpage.action?pageId=72803535#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

1. YCS支持黑匣子能力


##   [3. Interfaces（接口）](http://cod-conf.sics.com/pages/viewpage.action?pageId=72803535#3-interfaces%E6%8E%A5%E5%8F%A3)  

未增加新的外部接口，均为内部能力。

##   [4. Limitations（功能限制）](http://cod-conf.sics.com/pages/viewpage.action?pageId=72803535#4-limitations%E5%8A%9F%E8%83%BD%E9%99%90%E5%88%B6)  

本节只考虑ycs的黑匣子能力相关。

##   [5. Detail Design（详细设计）](http://cod-conf.sics.com/pages/viewpage.action?pageId=72803535#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

*方案设计的详细说明，包括但不限于方案选型、方案所依赖的技术/第三方组件的原理或背景介绍、关键技术点、方案折衷的考量、可靠性分析、兼容性分析。可以根据需要增删小节。*

###   [5.1 Architecture（架构）](http://cod-conf.sics.com/pages/viewpage.action?pageId=72803535#51-architecture%E6%9E%B6%E6%9E%84)  

*说明方案的总体架构，优先考虑通过架构图进行描述。 *

原有的黑匣子有提供一些函数接口供外部调用（注册、初始化）。

YCS集成黑匣子功能主要考虑这些函数放在instance的启动里即可。

#### 5.1.1 现有黑匣子能力在实例启动时做的事

1.先注册一些信号。

![](https://pingcode.yasdb.com/atlas/files/public/67396b188970c2af4f520188/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FFSUVBQVF3SkFBQUFBRUFBQUlBQUFBQUFBQUFBQUFDQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQWdBQUFBQUNBQUFBS0FBQUFBQUFBQUFBQUFBQUFFQVFBQUFBQUFBQUFBQUNBQUFBQUFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTA5MDYsImV4cCI6MTc4MjMwMTcwNn0.6TfpHr5nyd8XRMRrIdRsZXIC-NHAubd7NGoRmWDNX-4)

2.再启动bbx模块。

![](https://pingcode.yasdb.com/atlas/files/public/67396b188970c2af4f520189/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FFSUVBQVF3SkFBQUFBRUFBQUlBQUFBQUFBQUFBQUFDQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQWdBQUFBQUNBQUFBS0FBQUFBQUFBQUFBQUFBQUFFQVFBQUFBQUFBQUFBQUNBQUFBQUFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTA5MDYsImV4cCI6MTc4MjMwMTcwNn0.6TfpHr5nyd8XRMRrIdRsZXIC-NHAubd7NGoRmWDNX-4)

3.信号因为和操作系统相关，比较底层，所以注册的很早。

![](https://pingcode.yasdb.com/atlas/files/public/67396b188970c2af4f52018a/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FFSUVBQVF3SkFBQUFBRUFBQUlBQUFBQUFBQUFBQUFDQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQWdBQUFBQUNBQUFBS0FBQUFBQUFBQUFBQUFBQUFFQVFBQUFBQUFBQUFBQUNBQUFBQUFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTA5MDYsImV4cCI6MTc4MjMwMTcwNn0.6TfpHr5nyd8XRMRrIdRsZXIC-NHAubd7NGoRmWDNX-4)

blackbox模块在实例初始化完了之后，最后初始化。

这些都是我们可以借鉴的内容。

#### 5.1.2 我们现有的YCS启动流程。

1.createInstance之前基本就是在做一些环境变量和加载配置项的事。

![](https://pingcode.yasdb.com/atlas/files/public/67396b18a1ad9a3311dc8002/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FFSUVBQVF3SkFBQUFBRUFBQUlBQUFBQUFBQUFBQUFDQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQWdBQUFBQUNBQUFBS0FBQUFBQUFBQUFBQUFBQUFFQVFBQUFBQUFBQUFBQUNBQUFBQUFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTA5MDYsImV4cCI6MTc4MjMwMTcwNn0.6TfpHr5nyd8XRMRrIdRsZXIC-NHAubd7NGoRmWDNX-4)

2.YCS目前实例启动最先做的事是启动线程管理

![](https://pingcode.yasdb.com/atlas/files/public/67396b188970c2af4f52018c/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FFSUVBQVF3SkFBQUFBRUFBQUlBQUFBQUFBQUFBQUFDQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQWdBQUFBQUNBQUFBS0FBQUFBQUFBQUFBQUFBQUFFQVFBQUFBQUFBQUFBQUNBQUFBQUFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTA5MDYsImV4cCI6MTc4MjMwMTcwNn0.6TfpHr5nyd8XRMRrIdRsZXIC-NHAubd7NGoRmWDNX-4)

###   [5.2 Data Structures & Flow（数据结构与流程）](http://cod-conf.sics.com/pages/viewpage.action?pageId=72803535#52-data-structures--flow%E6%95%B0%E6%8D%AE%E7%BB%93%E6%9E%84%E4%B8%8E%E6%B5%81%E7%A8%8B)  

*设计主要数据结构、工作流程、序列图等。*

#### 5.2.1 我们的黑匣子流程放在启动里的位置

依据上面一节的流程梳理来看，我们的黑匣子集成时。

注册信号的动作应该放在codInitThreadManager之前。

而启动黑匣子模块的动作应该放在codInitThreadManager之后。

#### 5.2.2 黑匣子的放置路径

黑匣子的文件需要放在我们YCS的路径里。

目前考虑放在YASCS_HOME/diag/blackbox下面。

##   [6. Testcases（自测用例）](http://cod-conf.sics.com/pages/viewpage.action?pageId=72803535#6-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

*设计开发人员自测用例（文字描述）。*

在自己确定的位置刻意让代码core掉，但是不设置core的开关。看黑匣子能否记录上关键信息。

##   [7. Workload（工作量）](http://cod-conf.sics.com/pages/viewpage.action?pageId=72803535#7-workload%E5%B7%A5%E4%BD%9C%E9%87%8F)  

*评估代码量KLOC、工作量2（人天）。*

##   [8. TODO（遗留问题）](http://cod-conf.sics.com/pages/viewpage.action?pageId=72803535#8-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

## Attachments:

[WXWorkLocal_16859285022392.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMTdhMWFkOWEzMzExZGM3ZmY5IiwicmVmX2lkIjoiNjczOTZiMTc1OTNmOTljOWZmMjM1ZTFjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwOTA2LCJleHAiOjE3ODIzNzczMDZ9.tuJStCaISxyX_XomgHuWNwgkmlVOepV1qvsypxOYn3Q)

 (image/png)    


## Comments:

|  [](null)  ,YCS/YFS的instance里的内容打印在黑匣子里。,Posted by duyuxuan at 六月 16, 2023 16:40|
|---|
