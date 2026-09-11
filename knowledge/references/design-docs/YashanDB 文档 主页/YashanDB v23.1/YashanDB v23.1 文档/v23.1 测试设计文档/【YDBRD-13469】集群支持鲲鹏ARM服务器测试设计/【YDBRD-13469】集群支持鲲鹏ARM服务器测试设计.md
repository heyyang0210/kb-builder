Created by 高亚宁, last modified on 六月 05, 2023

# **1. 概述**

  


SR:        [YDBRD-13469](https://jira.yasdb.com/browse/YDBRD-13469?src=confmacro)    -  【共享集群】集群支持鲲鹏ARM服务器  完成

开发设计：    [支持鲲鹏ARM服务器 - 龙忠友 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=112726515)  

# **2. 需求分析**

### 功能描述：

集群支持鲲鹏ARM服务器，需要保证集群功能在鲲鹏arm服务器上正常，不会core

# **3. 测试**  **设计方法**   

主要采用场景法进行测试

1. 集群内核：  global memory（gcs、gls、grc）、ics，执行集群现有并发和一致性用例：    [storage_testcase_cluster · master · CoD-X / anchor_test · GitLab (yasdb.com)](https://git.yasdb.com/cod-x/anchor_test/-/tree/master/storage_testcase_cluster)    、    [consistency_testcase_cluster · master · CoD-X / anchor_test · GitLab (yasdb.com)](https://git.yasdb.com/cod-x/anchor_test/-/tree/master/consistency_testcase_cluster)  
1. 集群内核基本功能：执行集群现有功能用例：    [cluster · master · CoD-Test / yasft · GitLab (yasdb.com)](https://git.yasdb.com/cod-test/yasft/-/tree/master/cluster)  
1. 集群本身的组件/服务：ycs、yfs，1/2中基本上已做过全量覆盖，未自动化的用例有哪些？怎么执行？？——优先级低，SIT补测
1. 集群功能：复用单机的测试设计和测试用例：    [standalone · master · CoD-Test / yasft · GitLab (yasdb.com)](https://git.yasdb.com/cod-test/yasft/-/tree/master/standalone)  
1. 性能：在arm服务器上跑tpcc性能，对照下x86性能测试点，性能不下降——和庭德对接，需要跑一组性能数据出来，性能好坏暂时可不关注
1. 安装部署：在鲲鹏arm机器上用yasboot部署集群，模拟器、磁阵（单主机/多主机）、服务器都要覆盖，    [YCS+YCR+YFS+DB环境搭建指导 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=109596433#YCS+YCR+YFS+DB%E7%8E%AF%E5%A2%83%E6%90%AD%E5%BB%BA%E6%8C%87%E5%AF%BC-%E4%BA%8C%E3%80%81%E7%A3%81%E9%98%B5%E7%89%88%EF%BC%88%E5%8D%95%E4%B8%BB%E6%9C%BA%EF%BC%89)  


专项覆盖

|专项|是否涉及|
|:---|:---|
|并发|是|
|长稳|是|
|一致性|是|
|三方测试工具    
  (sqltest，sqlancer)|/|
|安全|/|
|DFR/testkill|暂不支持故障处理|
|HA|暂不支持HA|
|压力|/|
|性能|涉及|
|可维护性|/|
|兼容性|/|


# 4.   **详细测试设计**   

  


# 5.   **测试用例**

  


# 6.   **测试框架设计**

基本功能：使用guider框架执行

并发：使用testkill框架执行

一致性：使用一致性框架执行

安装部署：手动执行

性能：执行性能脚本——找庭德要

# 7.   **测试环境说明**

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|  
|
