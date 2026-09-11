Created by 吕雷奇, last modified on 七月 23, 2024

**IR链接：**    [https://pingcode.yasdb.com/ship/ideas/660b743e009f91eb87f2af6d](https://pingcode.yasdb.com/ship/ideas/660b743e009f91eb87f2af6d)    **?**    
  **#YASHAN-29 集群版本故障处理优化 （RTO目标）**

**SR链接：**    [https://pingcode.yasdb.com/pjm/items/66114fcc579a3edb84d66856](https://pingcode.yasdb.com/pjm/items/66114fcc579a3edb84d66856)    **?**    
  **#YDBRD-18597 支持recovery buddy**

**开发设计文档链接：**    [YDBRD-18597: Recovery Buddy Design（recovery buddy方案设计）](https://conf.yasdb.com/pages/viewpage.action?pageId=150628340)  

# 1. 概述

在现有的流程中故障恢复流程检测到集群中有故障节点后，存活实例中选举出一个实例做故障节点的在线恢复节点，根据故障节点的redo和undo日志回放或者撤销故障节点的历史操作，回放完成之后存活实例可以继续提供数据修改业务；友商在12c之后的版本中提供了“recovery buddy”功能，通过预分配方式，去掉了以上流程中通过选举找到可以提供在线在线恢复节点，同时将  redo日志恢复数据持续发送到指定的recovery buddy实例，故障节点的redo日志会在recovery buddy的内存中，可以快速恢复。

# 2. 需求分析

## 功能点分析

**2.1对现有流程变更**

a)配置了recovery buddy后，在线恢复流程中，省掉了选举找在线恢复节点的流程；

b)配置recovery buddy之后，故障节点的recovery buddy 通过从内存中完成故障节点的redo回放，而非从redo文件中读取再回放，这样速度更快，但是带来了一定的内存开销。

![](https://conf.yasdb.com/download/attachments/150628340/image2024-5-30_15-21-11.png?version=1&modificationDate=1717053672000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzIwOTcsImV4cCI6MTc4MjM4Mjg5N30.a0xYpyuRJVknZJmJp9TGXMZe0Rznuhz2C42j8EnRZWY)

**2.2 新增参数**

_buddy_instance_memory  :   表示recovery buddy恢复集占用share pool的百分比  ，默认10，取值范围 [5,100);

buddy_instance_scan_timeout  :   表示buddy instance扫描redo的等待间隔时间，单位为秒  ，默认10，取值范围 [0,无穷）;

buddy_instance_scan_interval  ：  表示buddy instance单次分析日志读取的pack数量  ，默认64M ，取值范围 [0,无穷）;

buddy_instance：表示伙伴实例的个数，配置为0，则不开启recovery buddy,配置大于1，效果等同于1，默认1，取值范围[0, 63];

v$share_pool : 视图新增recovery buddy pool显示数据(SQL POOL，DC POOL，LOCK_POOL，CURSOR_POOL之外再加了recovery buddy pool)。

## 2.2 规格约束

- 暂时不支持一个节点多个Buddy instance


# 3. 详细测试设计

## 3.1 测试设计方法

1、测试参数和对应视图，使用边界值和场景组合。

2、性能调优，做专项测试；

## 3.2 详细测试设计

**3.2.1 测试参数和对应视图**

|  
|测试项|测试场景|预期结果|实际结果|备注|
|:---|:---|:---|:---|:---|:---|
|1|_buddy_instance_memory|修改为下边界值5|成功|  
|  
|
|  
|  
|修改为上边界值99|成功|  
|  
|
|  
|  
|修改为4，100|失败|  
|  
|
|2|buddy_instance_scan_timeout|修改为下边界0|成功|  
|  
|
|3|  
|修改为较大值|成功|  
|  
|
|4|  
|使用默认值10s|  
|  
|  
|
|5|buddy_instance_scan_interval|修改为下边界0|  
|  
|  
|
|6|  
|修改为较大值|  
|  
|  
|
|7|  
|修改为中间值|  
|  
|  
|
|8|  
|使用默认值64M|  
|  
|  
|
|9|buddy_instance|修改为下边界0|  
|  
|  
|
|10|  
|修改为上边界63|  
|  
|  
|
|11|  
|修改为-1，64|  
|  
|  
|
|12|  
|使用默认值|  
|  
|  
|
|13|v$share_pool|视图字段显示正确|  
|  
|  
|
|14|  
|跑业务过程中并发查询视图|  
|  
|  
|


**3.2.2 故障测试**

|序号|测试场景|预期结果|实际结果|备注|
|:---|:---|:---|:---|:---|
|1|2实例下，默认参数下，业务下发+ 1个节点故障并发|  
|  
|现有CI工程已经用例有看护|
|2|2实例下，默认参数下，业务下发+ 每个节点先后循环故障并发|  
|  
|需要新增|
|3|2实例下，默认参数下，业务下发+ 2个节点同时故障后启动|  
|  
|现有CI工程已经用例有看护|
|4|4实例下，默认参数下，业务下发+ 任意1个节点故障|  
|  
|现有CI工程已经用例有看护|
|5|4实例下，默认参数下，业务下发+ 故障2个节点故障（实例1，3）|  
|  
|需要新增|
|6|4实例下，默认参数下，业务下发+ 故障2个节点故障（实例1，2）|  
|  
|现有CI工程已经用例有看护|
|7|4实例下，默认参数下，业务下发+ 故障3个节点故障（实例1，2，3）|  
|  
|现有CI工程已经用例有看护|
|8|4实例下，默认参数下，业务下发+ 循环故障拉起节点（实例1，2，3，4）|  
|  
|需要新增|


**3.2.3 性能调优**

|  
|测试场景|优先级|备注|
|:---|:---|:---|:---|
|1|默认参数下RTO场景下性能有提升|高|  
|
|2|RTO场景下最优参数调优|低|特性上车后调优|


3.2.3提前跑CI工程：

  [recovery_buddy工程分析 - 徐卓 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=159435717)  

  [recovery_buddy [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/user/xuzhuo/my-views/view/recovery_buddy/)  

**3.2.4 梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式**

|系统级DFX分类|是否涉及|备注|
|:---|:---|:---|
|CT|/|  
|
|KT|是|  
|
|长稳|是|  
|
|一致性|/|  
|
|三方测试工具    
  (sqltest，sqlancer)|/|  
|
|安全|/|  
|
|DFR|是|  
|
|HA|/|  
|
|压力|是|  
|
|性能|是|  
|
|可维护性|/|  
|


  


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


# 5. 测试框架设计

- 如果用例不能实现自动化需要在此标注并说明原因
- 确认使用的测试框架及其满足度


不涉及新增框架，ha_regress