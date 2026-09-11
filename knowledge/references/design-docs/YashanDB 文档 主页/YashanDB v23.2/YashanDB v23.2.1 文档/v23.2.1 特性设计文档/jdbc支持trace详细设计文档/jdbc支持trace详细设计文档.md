Created by 张周玺, last modified on 十二月 11, 2023

##   [1. Overview（概述）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#1-overview%E6%A6%82%E8%BF%B0)  

  [[YDBRD-18700] JDBC Driver增加TRACE功能 - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-18700)  

###   [1.1 需求来源](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#11-%E9%9C%80%E6%B1%82%E6%9D%A5%E6%BA%90)  

之前现网问题处理过程中，经常遇到一线和客户反馈性能问题，无法确定是客户代码处理逻辑有问题导致的还是jdbc导致的，还是服务端处理慢导致的，所以为了满足性能问题的定位定界，给jdbc常用的接口增加了日志。

**本需求为jdbc需求，不区分单机/集群，行存/列存。**

###   [1.2 调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#12-%E8%B0%83%E7%A0%94%E6%96%87%E6%A1%A3)  

Oracle也有日志功能，Oracle出了一个单独的带日志的驱动包，但是考虑到定位问题如果需要换包才能打日志，在实际操作种会带来非常多的不便，所以最终还是决定不要分成两个包。

日志框架调研：

经过调研，Java目前的日志三方件 log4j ，log4j2、logback、SLF4J等所以的日志三方件都是支持需求里描述的可配置，控制文件大小，输出路径控制等等功能，所以沿用原来的log去做日志输出就可以了。

关于Java主流的日志门面框架和具体实现见：    [全网最全、最细致的Java日志框架以及门面技术。-腾讯云开发者社区-腾讯云 (tencent.com)](https://cloud.tencent.com/developer/article/1876048)  

###   [1.3 需求分析](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#13-%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  

1、  在客户端记录application id, SQL语句，语句发起/返回时间点到trace log。

2、可配置，对客户端性能影响小。

3、重点记录的功能，获取连接，prepare，execute ，fetch,主要这四大块功能的起始时间，sql语句等信息。

4、要考虑目前的jdbc实现能否兼容主流的日志框架，需要怎么配置。

5、要考虑加日志的场景，日志内容，日志格式等等。

  


###   [1.4 数据字典](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#14-%E6%95%B0%E6%8D%AE%E5%AD%97%E5%85%B8)  

**不涉及**

###   [1.5 开源依赖](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#15-%E5%BC%80%E6%BA%90%E4%BE%9D%E8%B5%96)  

代码不依赖开源三方件，但是测试时可以配合 log4j ，log4j2、logback、SLF4J三方件来进行测试。

##   [2. 接口](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#2-%E6%8E%A5%E5%8F%A3)  

本次不涉及接口修改，不涉及新增配置参数的修改

##   [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

**不涉及。**

##   [4. 特性](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#4-%E7%89%B9%E6%80%A7)  

###   [4.1 ](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#14-%E6%95%B0%E6%8D%AE%E5%AD%97%E5%85%B8)    日志框架配置介绍

目前崖山的jdbc支持两种门面技术：SLF4J和JCL:

JCL需要引入三方包Apache的commons-logging，主要支持原生的Java原生的JUL

SLF4J既支持Java原生的JUL，又支持三方的 log4j ，log4j2、logback等。SLF4J需要引入slf4j-api的包，然后如果搭配原生JUL，需要引入slf4j-jdk14包；搭配其它三方件也是类似，引入对应的slf4j-xxx的包，以及实现本身的包就可以了。

log配置文件：    
  用哪一种日志实现，就去配置对应的配置文件就可以了，其中如果用原生JUL，配置文件默认在java.home的lib目录下的  logging.properties。各种日志实现的配置可参考：    [【精选】Java日志-总结【这一篇够了】_程序员一灯的博客-CSDN博客](https://blog.csdn.net/imjcoder/article/details/121688831?spm=1001.2101.3001.6650.2&utm_medium=distribute.pc_relevant.none-task-blog-2%7Edefault%7EBlogCommendFromBaidu%7ERate-2-121688831-blog-80447653.235%5Ev38%5Epc_relevant_sort_base3&depth_1-utm_source=distribute.pc_relevant.none-task-blog-2%7Edefault%7EBlogCommendFromBaidu%7ERate-2-121688831-blog-80447653.235%5Ev38%5Epc_relevant_sort_base3&utm_relevant_index=3)  

###   [4.2 ](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#14-%E6%95%B0%E6%8D%AE%E5%AD%97%E5%85%B8)    本次新增日志内容

本次新加的日志级别定为trace，防止误打。

本次加日志的点：

  


获取连接

开始：connect start,timestamp:{},ip/port:{},serverType:{}

结束：connect end,timestamp:{},sission id:{},connectVersion:{}

  


关闭连接

开始：connect close start,timestamp:{},sission id:{}

开始：connect close end,timestamp:{},sission id:{}

  


prepare:

开始：prepare start,timestamp:{},session id:{}, sql:{}

结束：prepare end,timestamp:{},session id:{},statement id:{}

  


prepareExecute：

开始：prepareStatement execute start,timestamp:{},session id:{}, Statement id:{}

结束：prepareStatement execute end,timestamp:{},session id:{}, Statement id:{}    
    
  直接执行：

开始：statement execute start,timestamp:{}, Statement id:{},sql:{}

结束：statement execute end,timestamp:{},session id:{}, Statement id:{}    
    
  fetch:    
  开始：fetchMore start,timestamp:{},session id:{}, Statement id:{}    
  结束：fetchMore end,timestamp:{},session id:{}, Statement id:{}

  


以上所有的日志，均保证打日志的逻辑代码不引入任何异常，空指针等等。

**正常执行情况下**  start-end成对出现都能打出来，但是中途抛异常的情况下不保证end能正常打印，因为这些异常均由上层去捕获的，异常信息已经告诉用户发生什么事情了，所以这里再去打结束时间就没啥意义了。

注：本次新加所有日志信息都是打印现有信息，不会为了日志打印而增加额外的逻辑或者其它消耗，所以理论上应该对性能无影响

##   [5. Testcases（自测用例）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#6-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

自测场景：

1、获取连接，关闭连接

2、直接执行。

3、prepareStatement的prepare、绑定执行、批量绑定执行。

4、CallableStatement的prepare和绑定执行。

5、查询10行以上的数据，触发fetch.

测试建议：

咱们的jdbc和所有的日志框架都能适配，所以也不用关心日志框架的搭配，选择一种搭配，通过配置只要能打印出日志，其实其它的也就肯定都可以了。

##   [6.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#6%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

*本需求不涉及资料修改。*

##   [7.未来规划](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#7%E6%9C%AA%E6%9D%A5%E8%A7%84%E5%88%92)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。

  


## Attachments:

[image2023-11-1_10-47-7.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMTNhMWFkOWEzMzExZGM4NzgwIiwicmVmX2lkIjoiNjczOTZjMTI3MjgyMDZlZmI5MmYwZDU4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk4OTY2LCJleHAiOjE3ODIzODUzNjZ9.FYdFhy6xeJhZMKy21RcM_sZP0QFArdlDOq83jRW4qVY)

 (image/png)    


[image2023-11-1_14-44-23.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMTM4OTcwYzJhZjRmNTIwOTEwIiwicmVmX2lkIjoiNjczOTZjMTI3MjgyMDZlZmI5MmYwZDU4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk4OTY2LCJleHAiOjE3ODIzODUzNjZ9.nRmGfpZBoDitWGEEdA0Yw8kCUl9ActIhmAyb0bpO01c)

 (image/png)    


[image2023-11-1_14-44-40.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMTM4OTcwYzJhZjRmNTIwOTEyIiwicmVmX2lkIjoiNjczOTZjMTI3MjgyMDZlZmI5MmYwZDU4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk4OTY2LCJleHAiOjE3ODIzODUzNjZ9.OoMVPTxg_XzmaYWRYO2zLRuNjnWr6QTS2tLgEzP4iYI)

 (image/png)    
