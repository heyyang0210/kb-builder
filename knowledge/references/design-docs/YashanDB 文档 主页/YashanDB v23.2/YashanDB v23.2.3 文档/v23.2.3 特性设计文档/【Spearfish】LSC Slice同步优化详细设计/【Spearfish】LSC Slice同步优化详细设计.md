Created by 谢锐, last modified on 五月 08, 2024

##   [1. Overview（概述）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#1-overview概述)  

LSC主备同步需要保证Redo发送到备机时，小于等于该LFN的SLice文件已同步到备机。

当前实现是在redo发送时，检查对应LFN下是否还有SLice发送。而Slice同步在尚未完成时就已经取了LFN。这样redo发送的等待时间就可能特别长(即需要等待Slice文件发送)。

尤其是主备同步较慢时，会阻塞内部其他事务（尤其是自治事务）提交，导致系统并发能力上不去。

  


如下图scol sync busy wait事件的时间已达到40s，在整个log file sync中也有不小的比例。

  


  


![](https://pingcode.yasdb.com/atlas/files/public/67396d5e8970c2af4f52124e/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQkFnQUFVQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFCQUFBQUFRQUFBQUFBZ0FCQUFBQUFBQUFBQUFnQWdBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQURnZ0FBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQkFBQUFBRUFFQUFBQUFFQUFBQUFFQUFnQUFBQWdBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDc2ODYsImV4cCI6MTc4MjMxODQ4Nn0.E69EDi8RRPUBiUiI50ULF6_Jk_LEE8QOGXsZ6BwHQY4)

  


  


##   [2. 需求分析](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#2-features功能特性)  

  


LSC SLice文件发送并不应该阻塞redo发送，只有在设置与同步LSC Slice LFN期间阻塞redo 发送即可。

即将阻塞时间缩小到最短。查看方式：

select * from v$system_event where TOTAL_WAITS > 0 order by AVERAGE_WAIT desc;

使用该语句，观察scol sync busy wait 等待事件即可。

  


在本地对比测试如下：

![](https://pingcode.yasdb.com/atlas/files/public/67396d5e8970c2af4f52124f/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQkFnQUFVQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFCQUFBQUFRQUFBQUFBZ0FCQUFBQUFBQUFBQUFnQWdBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQURnZ0FBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQkFBQUFBRUFFQUFBQUFFQUFBQUFFQUFnQUFBQWdBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDc2ODYsImV4cCI6MTc4MjMxODQ4Nn0.E69EDi8RRPUBiUiI50ULF6_Jk_LEE8QOGXsZ6BwHQY4)

  


分析备机的最大影响计算方法：scol sync busy wait + redo remote send + redo remote sync complete + log file parallel write

redo remote sync complete： 在提交时如果redo未发送完会出现等待，rdFlushForCheckpoint时也可能触发该等待事件，所以实际不能全部算入。

redo remote send：给备机发送redo占用的时间。

scol sync busy wait：主机发送redo等待lsc slice同步时间。

log file parallel write：本地flush redo时间，这个只能算增量，与备机共享磁盘的话降低了log写性能。

  


将LFN设置放到Slice文件同步完成后：

  


![](https://pingcode.yasdb.com/atlas/files/public/67396d5e8970c2af4f521250/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQkFnQUFVQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFCQUFBQUFRQUFBQUFBZ0FCQUFBQUFBQUFBQUFnQWdBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQURnZ0FBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQkFBQUFBRUFFQUFBQUFFQUFBQUFFQUFnQUFBQWdBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDc2ODYsImV4cCI6MTc4MjMxODQ4Nn0.E69EDi8RRPUBiUiI50ULF6_Jk_LEE8QOGXsZ6BwHQY4)

  


可见scol sync busy wait的时间可忽略不计。

  


降低备机发送速度后对比测试：

![](https://pingcode.yasdb.com/atlas/files/public/67396d5ea1ad9a3311dc90bf/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQkFnQUFVQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFCQUFBQUFRQUFBQUFBZ0FCQUFBQUFBQUFBQUFnQWdBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQURnZ0FBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQkFBQUFBRUFFQUFBQUFFQUFBQUFFQUFnQUFBQWdBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDc2ODYsImV4cCI6MTc4MjMxODQ4Nn0.E69EDi8RRPUBiUiI50ULF6_Jk_LEE8QOGXsZ6BwHQY4)

Table LINEITEM1:    
  6001215 logical rows read.    
  6001215 rows successfully loaded.    
  0 rows not loaded due to data errors.    
  0 rows not loaded because all fields were null.

Elapsed time was: 00:01:14.123

  


优化后可以看到scol sync busy wait的时间可忽略不计，整体性能也从74s提升到40s：

![](https://pingcode.yasdb.com/atlas/files/public/67396d5ea1ad9a3311dc90c0/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQkFnQUFVQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFCQUFBQUFRQUFBQUFBZ0FCQUFBQUFBQUFBQUFnQWdBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQURnZ0FBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQkFBQUFBRUFFQUFBQUFFQUFBQUFFQUFnQUFBQWdBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDc2ODYsImV4cCI6MTc4MjMxODQ4Nn0.E69EDi8RRPUBiUiI50ULF6_Jk_LEE8QOGXsZ6BwHQY4)

Table LINEITEM1:    
  6001215 logical rows read.    
  6001215 rows successfully loaded.    
  0 rows not loaded due to data errors.    
  0 rows not loaded because all fields were null.

Elapsed time was: 00:00:40.174

  


##   [3. Interfaces（接口）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#3-interfaces接口)  

列出本方案对外提供的接口、配置参数、API等。

  


不涉及。

##   [4. Specification And Constraints（规格与约束）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#4-specification-and-constraints规格与约束)  

说明本方案对外的功能规格或约束。

  


不涉及。

##   [5. Detail Design（详细设计）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#5-detail-design详细设计)  

方案设计的详细说明，包括但不限于方案选型、方案所依赖的技术/第三方组件的原理或背景介绍、关键技术点、方案折衷的考量、可靠性分析、兼容性分析。可以根据需要增删小节。

  


1，将LFN获取的逻辑放在LSC SLice同步完成后。

2，将更新data bucket空间使用的自治事务移到LSC Slice同步后，优先完成Slice发送，减少阻塞发生场景。

  


其他改动：

1，等待Slice文件发送完成的等待事件统计。

    计入redo remote sync complete。

  


###   [5.3 Compatibility（兼容性）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#53-compatibility兼容性)  

  


不涉及

###   [5.4 DFX设计](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#54-dfx设计)  

按特性的种类可选，涉及安全、性能、可靠、可维、可测；

1.协议、驱动、访问控制、通讯、加密等特性需求，要考虑安全；

2.执行表达式和算子类的特性需求，需要考虑性能；

3.主备、容灾、存储等的特性需求，需要考虑可靠性；

4.所有特性均需要考虑可维、可测。

###   [5.5 其他](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#55-其他)  

根据特性开发的种类，有不同的涉及相关项, 如下示例，不同的特性种类关心范围有所差异，需要根据特性种类来扩展：

**涉及数据库语法开发，需要考虑系统权限和系统审计。**

**涉及数据库对象的特性开发，需要考虑对象级权限、对象级审计、对象安全访问和主备同步实现。**

##   [6. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#6-testcases自测用例)  

设计开发人员自测用例（文字描述），给出开发者自测试的设计方案表格或者XMIND、开发自测的用例归档路径。

  


需要模拟主备同步较慢的场景来验证，效果更加明显。

##   [7.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#7资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [8. TODO（遗留问题）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#8-todo遗留问题)  

*说明本方案遗留的问题或下一步需要解决的问题。*

## Attachments: