Created by 李世铭, last modified on 五月 05, 2023

# **1、概述**

**yashandb目前有单机、分布式、集群三种架构，目前om已支持单机和分布式架构的部署，现按照单机和分布式的部署的基本流程，实现集群架构的部署**

**参考YCS部署文档：**    [Linux下使用模拟器搭建YCS+正式版YFS+DB(磁阵版绝对路径)环境（废弃）](https://conf.yasdb.com/pages/viewpage.action?pageId=100089459)  

**SR：**    [YDBRD-13329](https://jira.yasdb.com/browse/YDBRD-13329?src=confmacro)    **-**  **【OM】支持通过ycs工具部署集群数据库**  **完成**    [YDBRD-13326](https://jira.yasdb.com/browse/YDBRD-13326?src=confmacro)    **-**  **【OM】支持clean集群数据库**  **完成**    [YDBRD-13211](https://jira.yasdb.com/browse/YDBRD-13211?src=confmacro)    **-**  **【OM】支持集群数据库启停操作**  **完成**

# **2、需求分析**

## **2.1 需求描述**

- 支持yashandb集群架构的部署
- 支持启停集群架构的yashandb
- 支持卸载集群架构的yashandb


## **2.2 功能特性**

yasboot package config gen --yas-type新增CE（集群）类型

新增--ce参数，控制节点数量

新增--ce-mode参数，选择模拟器模式部署还是磁阵模式部署

新增--ce-data参数，设置数据盘路径

新增--ce-vote参数，设置选举盘路径

部署，启停和卸载可以使用原有的命令

## **2.3 特性约束**

- yashandb已经部署起来切是无业务状态
- 各节点机器需要停止monitor


# **3、测试设计方法**

主要采用的等价类划分，边界值，场景法组合及错误推测法进行设计 

测试点：

1.参数校验

2.部署模式：模拟器单机，磁阵单机，磁阵多机

3.部署规模：模拟器1~4个节点，磁阵1~4个节点

4.启停方式：  cluster|group start/stop    
  node start/stop

# **4、详细测试设计**

## **4.1 参数验证**

|  
|参数测试|  
|
|---|---|---|
|1|--yas-type|CE|
|  
|  
|参数简写-t|
|2|--ce-mode|DISK|
|  
|  
|SIMS|
|  
|  
|默认值|
|  
|  
|其他值|
|3|--ce-data|磁阵挂载路径|
|  
|  
|默认值|
|  
|  
|其他路径|
|4|--ce-vote|磁阵挂载路径|
|  
|  
|默认值|
|  
|  
|其他路径|
|5|--ce|1~4|
|  
|  
|默认值|
|  
|  
|其他值|


## **4.2 部署及卸载场景**

|  
|场景|  
|
|---|---|---|
|1|模拟器模式，不同节点规模部署|节点规模：1~4|
|2|磁阵单机模式，不同节点规模部署|节点规模：1~4|
|3|磁阵跨机部署，不同节点规模部署|节点规模：1~4，部署在多台主机|


## **4.2 启停场景**

|  
|场景|  
|
|---|---|---|
|  
|部署方式|模拟器模式，磁阵多机模式|
|1|集群启停|启动|
|  
|  
|停止|
|  
|  
|open时启动|
|  
|  
|stop时停止|
|  
|  
|起库模式：nomount、open|
|2|group启停|启动|
|  
|  
|停止|
|  
|  
|open时启动|
|  
|  
|stop时停止|
|  
|  
|起库模式：nomount、open|
|3|node启停|启动|
|  
|  
|停止|
|  
|  
|open时启动|
|  
|  
|stop时停止|
|  
|  
|起库模式：nomount、open|
