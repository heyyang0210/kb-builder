Created by 廖增康, last modified on 十月 15, 2024

# 分布式CN扩容设计

##   [1. Overview（概述）](https://conf.yasdb.com/pages/viewpage.action?pageId=11698367#1-overview%E6%A6%82%E8%BF%B0)  

需求背景:

   多cn场景下，通过在线扩容cn节点，提高分布式数据库处理能力，通过cn流程让缩容cn节点重新加入分布式集群中。

##   [2. Features（功能特性）](https://conf.yasdb.com/pages/viewpage.action?pageId=11698367#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

1. 新增CN节点通过扩容方式加入集群，对外提供服务.
1. 故障节点恢复后通过扩容方式重新加入集群.


##   [3. Interfaces（接口）](https://conf.yasdb.com/pages/viewpage.action?pageId=11698367#3-interfaces%E6%8E%A5%E5%8F%A3)  

### OM命令

om设计文档：    [om支持CN组内扩容节点方案设计](119552900.html)  

3.1生成扩容配置文件

主机不存在

```
yasboot config node gen -c yashandb -u yashan -p password --ip 127.0.0.1 --port 22 --node 2
```

参数：

|选项|含义|
|:---|:---|
|-c, --cluster|生成的集群名称|
|-u, --username|主机ssh用户名|
|-p, --password|ssh登录密码|
|-N|ssh免密登录|
|--ip|部署的ip地址，允许多个ip上新增|
|--port|主机ssh连接端口|
|-i, --install-path|数据库安装路径（HOME目录）|
|--data-path|数据库实例的DATA目录|
|-f, --force|是否强制部署数据库，强制表示不会检查当前主机运行状态是否能够部署|
|-g,--group-id|组id。默认为1|
|--node|新增的总节点数。默认为1|


  


主机存在

```
yasboot config node gen --host-id host0001,host0002 --group-id 1 --node 2 --cluster yashandb
```

|选项|含义|
|---|---|
|--host-id|主机的id，允许多个主机|
|--group-id|组id。默认为1|
|--node|新增的总节点数。默认为1|
|--cluster|集群名称|


  


部署主机

```
yasboot host add --install-pkg yashandb-22.2.0.9-linux-x86_64.tar.gz -t hosts_add.toml
```

|选项|含义|
|:---|:---|
|--disable|屏蔽任务进度条展示|
|-c,--cluster|集群名称|
|-f, --force|忽略错误并强制安装，默认为false|
|-i,--install-pkg|软件包文件本地路径|
|-t,--toml|要安装软件包的主机相关信息的配置文件|


  


3.2 扩容

```
yasboot node add --toml yasdbName_add.toml --cluster yashandb
```

|选项|含义|
|:---|:---|
|-t,--toml|扩容的节点配置文件|
|-c,--cluster|集群名称|


  


##   [4. Limitations（功能限制）](https://conf.yasdb.com/pages/viewpage.action?pageId=11698367#4-limitations%E5%8A%9F%E8%83%BD%E9%99%90%E5%88%B6)  

1. 扩容CN期间禁止执行分布式DDL.
1. 新扩容CN节点扩容期间禁止执行DML.
1. 元数据迁移最大SQL语句长度不能超过2M长度。
1. CN扩容暂时不支持同时扩容多个节点，只支持一次扩容一个节点，扩容多个节点OM顺序调用扩容单个节点。


##   [5. Detail Design（详细设计）](https://conf.yasdb.com/pages/viewpage.action?pageId=11698367#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

一. CN扩容流程:

1. 调用CM高级包把新CN节点加入到CM集群中，注册CN节点信息。
1. OM 拉起新CN实例到mount状态。
1. OM 调用高级包设置CN节点为不能对外提供服务状态 ，并把状态持久化到控制文件中。
1. OM 调用新CN节点高级包建库，节点到OPEN状态。
1. OM 调用高级包注册CN扩容任务，启动扩容任务执行。
1. 扩容任务调用元数据迁移子任务从MN节点迁移全量元数据。
1. 设置禁止执行分布式DDL标志位。
1. 检查当前推送系统表DDL_QUEUE$异常DDL记录是否为空，不为空等待60秒，还不为空返回扩容任务失败。
1. 导出MN节点全量元数据SQL语句到LOB文件中。
1. 启动新CN节点元数据迁移子任务远程任务。
1. 远程任务执行MN节点元数据迁移任务发送的SQL语句，迁移元数据。
1. 远程任务节点到元数据迁移完成标志位后清理不能对外提供服务标志位，结束远程任务。
1. 元数据迁移任务迁移完成元数据后清理禁止执行分布式DDL标志位。
1. CN扩容任务完成。


     扩容流程图:



二. CN扩容流程异常处理: 

     1. 扩容流程失败整个扩容任务回滚，再次执行扩容重新开始执行整个扩容流程。

     2. CN扩容暂时不支持同时扩容多个节点，需要扩容多个节点可以顺序执行扩容命令。

     3. CN扩容进度可以通过task

  


三. 扩容CN节点不能对外提供服务处理方案。

     1. OM拉取新CN 节点到nomount状态，OM调高级包设置CN节点不能提供服务标志位，标志位通过写控制文件持久化，扩容完成后清理标志位。

     2. 分布式CN节点启动流程需要加载控制文件标志位设置。



四. 高级包接口:

     1. 注册扩容任务高级包:



```
DECLARE
    task_id BIGINT;
BEGIN
    DBMS_TASK.ADD(
        task_id,
        'ADD_CN_NODE',
        '{"NODE": "2-3"}'
    );
    DBMS_TASK.START(task_id)；
END;
/

```

   2. 新扩容CN节点禁止对外服务和清理对外服务标志位高级包:

```
DBMS_MM.FORBID_CN_SERVICE()

DBMS_MM.ALLOW_CN_SERVICE()

```

  


###   [5.1 Architecture（架构）](https://conf.yasdb.com/pages/viewpage.action?pageId=11698367#51-architecture%E6%9E%B6%E6%9E%84)  

*说明方案的总体架构，优先考虑通过架构图进行描述。*

  [分布式总体设计](/pages/createpage.action?spaceKey=YAS&title=%E5%88%86%E5%B8%83%E5%BC%8F%E6%80%BB%E4%BD%93%E8%AE%BE%E8%AE%A1)  

###   [5.2 Data Structures & Flow（数据结构与流程）](https://conf.yasdb.com/pages/viewpage.action?pageId=11698367#52-data-structures--flow%E6%95%B0%E6%8D%AE%E7%BB%93%E6%9E%84%E4%B8%8E%E6%B5%81%E7%A8%8B)  

###   [5.3 Compatibility（兼容性）](https://conf.yasdb.com/pages/viewpage.action?pageId=11698367#53-compatibility%E5%85%BC%E5%AE%B9%E6%80%A7)  

*说明设计方案对兼容性的影响，如果影响了兼容性，则需要给出详细的兼容性方案设计*

##   [6. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=11698367#6-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

##   [7. Document（资料）](https://conf.yasdb.com/pages/viewpage.action?pageId=11698367#7-document%E8%B5%84%E6%96%99)  

##   [8. Workload（工作量）](https://conf.yasdb.com/pages/viewpage.action?pageId=11698367#8-workload%E5%B7%A5%E4%BD%9C%E9%87%8F)  

   工作量评估:  

|  
|  
|  
|  
|
|---|---|---|---|
|1|CN扩容元数据迁移支持tablespace迁移，table元数据迁移默认表空间修改|2D|  
|
|2|user profile元数据迁移(包含user过期时间)|2D|  
|
|3|DN扩容任务修改支持CN扩容|2D|  
|
|4|禁止新扩容CN节点对外提供服务|1D|  
|
|4|整体流程联调自测|2D|  
|
|  
|  
|  
|  
|
|  
|  
|  
|  
|


##   [9. TODO（遗留问题）](https://conf.yasdb.com/pages/viewpage.action?pageId=11698367#9-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

*说明本方案遗留的问题或下一步需要解决的问题。*

  


  


## Attachments:

[扩容CN流程图.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMjZhMWFkOWEzMzExZGM4MDliIiwicmVmX2lkIjoiNjczOTZiMjY3MjgyMDZlZmI5MmYwMjVkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkxNDA1LCJleHAiOjE3ODIzNzc4MDV9.1R0auxUO0SlZIJnjkwtT3pfcjA2ejren2Wc7Os4K4fQ)

 (image/png)    


[缩容CN节点.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMjY4OTcwYzJhZjRmNTIwMjI1IiwicmVmX2lkIjoiNjczOTZiMjY3MjgyMDZlZmI5MmYwMjVkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkxNDA1LCJleHAiOjE3ODIzNzc4MDV9._-Jbe303Q092t5fJDFn_5cwwJbphUWv7q3sPcB_PhJk)

 (image/png)    


[cn缩容流程图.drawio.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMjZhMWFkOWEzMzExZGM4MDlkIiwicmVmX2lkIjoiNjczOTZiMjY3MjgyMDZlZmI5MmYwMjVkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkxNDA1LCJleHAiOjE3ODIzNzc4MDV9.XXS0OTXbajbKvHaPIvQXLwG_YLQyGl5zNvYj4XL7rVY)

 (image/png)    


[cn_scale_out.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMjZhMWFkOWEzMzExZGM4MDllIiwicmVmX2lkIjoiNjczOTZiMjY3MjgyMDZlZmI5MmYwMjVkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkxNDA1LCJleHAiOjE3ODIzNzc4MDV9.EZ7ZEKCS77oqhmDDkRQ20yMsMnzmU4S-qEU0NMPTF0A)

 (image/png)    


[cn_scale_out.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMjc4OTcwYzJhZjRmNTIwMjI2IiwicmVmX2lkIjoiNjczOTZiMjY3MjgyMDZlZmI5MmYwMjVkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkxNDA1LCJleHAiOjE3ODIzNzc4MDV9.XF6b6WkJVN_pdkuiXTbXBvT6MCr9d5sVhvLP0mnlKcI)

 (image/png)    


## Comments:

|  [](null)  ,1.扩容多个节点是支持的，由OM承载    
  2.扩容以后如何加到JDBC？ 修改TAF的步骤？     
  3.failpoint用例？,Posted by liaozengkang at 七月 11, 2023 11:15|
|---|
