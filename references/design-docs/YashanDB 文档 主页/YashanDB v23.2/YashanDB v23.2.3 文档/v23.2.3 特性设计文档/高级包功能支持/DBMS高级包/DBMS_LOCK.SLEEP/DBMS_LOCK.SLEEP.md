Created by 唐嘉欣, last modified on 九月 07, 2023

参考文档：    [sleep - 丁心语 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/display/~dingxinyu/sleep)  

JIRA：  *暂无*

##   [1. Overview（概述）](https://conf.yasdb.com/pages/viewpage.action?pageId=11698367#1-overview%E6%A6%82%E8%BF%B0)  

*-Oracle的sleep函数在存储过程使用（DBMS_LOCK.SLEEP()、*  *DBMS_SESSION*  *.*  *sleep()*  *）*

*-mysql的sleep函数在sql语句中使用*

*-客户需求实现dbms_lock.sleep()*

##   [2. Features（功能特性）](https://conf.yasdb.com/pages/viewpage.action?pageId=11698367#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

*dbms_lock.sleep(duration)接受一个参数输入，根据输入的参数暂停对应的时间，单位为秒。*

1.单位的精确度

由于语句的执行时间原因，oracle结果在微秒部分存在一定误差。

![](https://pingcode.yasdb.com/atlas/files/public/67396d8d8970c2af4f521397/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUJBQUFBZ0FJQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFDQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBUWdBQUFBQUFBQUFBQkFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFnQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDkyNjgsImV4cCI6MTc4MjMyMDA2OH0.SIpZNi9fWiIkLjZcJb5tnzmk8CEPMqoLs8HKcQTRmN8)

yasdb实现为精确到秒后小数点后三位，由于语句执行时间原因，如图测试语句情况下结果在微秒部分可能存在误差

![](https://pingcode.yasdb.com/atlas/files/public/67396d8da1ad9a3311dc9207/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUJBQUFBZ0FJQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFDQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBUWdBQUFBQUFBQUFBQkFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFnQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDkyNjgsImV4cCI6MTc4MjMyMDA2OH0.SIpZNi9fWiIkLjZcJb5tnzmk8CEPMqoLs8HKcQTRmN8)

2.取消

在oracle的sleep执行过程中，可以通过ctrl+c退出，可以通过kill session等强制退出程序的方法退出。

在yasdb实现中，可以通过ctrl+c退出或kill进程等强制退出的方法退出

![](https://pingcode.yasdb.com/atlas/files/public/67396d8da1ad9a3311dc9208/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUJBQUFBZ0FJQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFDQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBUWdBQUFBQUFBQUFBQkFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFnQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDkyNjgsImV4cCI6MTc4MjMyMDA2OH0.SIpZNi9fWiIkLjZcJb5tnzmk8CEPMqoLs8HKcQTRmN8)

##   [3. Interfaces（接口）](https://conf.yasdb.com/pages/viewpage.action?pageId=11698367#3-interfaces%E6%8E%A5%E5%8F%A3)  

*bipVerifySleep*

*bipExecSleep*

##   [4. Limitations（功能限制）](https://conf.yasdb.com/pages/viewpage.action?pageId=11698367#4-limitations%E5%8A%9F%E8%83%BD%E9%99%90%E5%88%B6)  

*1.参数类型限制*

|boolean|成功，暂停隐式转换后的参数时间|
|:---|:---|
|char、varchar、varchar2|若可隐式转成数值型，则成功，暂停转换后的参数时间；,若不可隐式转成数值型，则失败报类型转换错误|
|tinyint、smallint、integer、bigint|成功，暂停参数时间|
|float、double、number|成功，暂停参数时间|
|date、timestamp、time|失败报类型错误|
|intervalYM、intervalDS|失败报类型错误|
|blob、clob|失败报类型错误|
|bit|成功，暂停隐式转换后的参数时间|
|null|失败报argument null|


2.参数范围为[0,21474836.47]

3.可以使用变量

  


##   [5. Detail Design（详细设计）](https://conf.yasdb.com/pages/viewpage.action?pageId=11698367#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

###   [5.1 Architecture（架构）](https://conf.yasdb.com/pages/viewpage.action?pageId=11698367#51-architecture%E6%9E%B6%E6%9E%84)  

*说明方案的总体架构，优先考虑通过架构图进行描述。*

###   [5.2 Data Structures & Flow（数据结构与流程）](https://conf.yasdb.com/pages/viewpage.action?pageId=11698367#52-data-structures--flow%E6%95%B0%E6%8D%AE%E7%BB%93%E6%9E%84%E4%B8%8E%E6%B5%81%E7%A8%8B)  

*设计主要数据结构、工作流程、序列图等。*

###   [5.3 Compatibility（兼容性）](https://conf.yasdb.com/pages/viewpage.action?pageId=11698367#53-compatibility%E5%85%BC%E5%AE%B9%E6%80%A7)  

*说明设计方案对兼容性的影响，如果影响了兼容性，则需要给出详细的兼容性方案设计*

##   [6. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=11698367#6-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

*begin*

*dbms_lock.sleep(10);*

*end;*

*/*

  


*begin*

*dbms_lock.sleep('10');*

*end;*

*/*

  


*begin*

*dbms_lock.sleep('abc');*

*end;*

*/*

  


*begin*

*dbms_lock.sleep(null);*

*end;*

*/*

  


*begin*

*dbms_lock.sleep();*

*end;*

*/*

  


##   [7. Document（资料）](https://conf.yasdb.com/pages/viewpage.action?pageId=11698367#7-document%E8%B5%84%E6%96%99)  

##   [8. Workload（工作量）](https://conf.yasdb.com/pages/viewpage.action?pageId=11698367#8-workload%E5%B7%A5%E4%BD%9C%E9%87%8F)  

*评估代码量KLOC、工作量（人天）。*

##   [9. TODO（遗留问题）](https://conf.yasdb.com/pages/viewpage.action?pageId=11698367#9-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

*说明本方案遗留的问题或下一步需要解决的问题。*

  


## Attachments: