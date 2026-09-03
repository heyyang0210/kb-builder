Created by 张丽红, last modified on 五月 11, 2024

**IR链接：**    [https://pingcode.yasdb.com/ship/ideas/660b743f009f91eb87f2b03e](https://pingcode.yasdb.com/ship/ideas/660b743f009f91eb87f2b03e)    **?**    
  **#YASHAN-238 OM支持ycs/yfs建库参数配置**

**关联SR链接：**    [https://pingcode.yasdb.com/pjm/items/661e3d4dfd997db58adabc9c](https://pingcode.yasdb.com/pjm/items/661e3d4dfd997db58adabc9c)    **?**    
  **#YDBRD-26427 【OM】部署共享集群时，支持ycs/yfs建库参数配置**

**开发概要设计文档：**    [【OM】部署共享集群时，支持ycs、yfs建库参数配置](150621044.html)  

# 1. 需求概述

场景：集群模式下

 1、安装部署过程可对yfs、ycs建库参数配置可视化 

2、安装部署过程命令行模式下可配置文件 

# 2. 功能点

1、  安装部署过程可对yfs初始化参数和建DG相关参数进行配置

2、  安装部署过程可对ycs建库参数和心跳参数进行配置

3、执行"cluster clean"操作时实现机制层面从"yfscmd rm -rf +DG0/dbfiles"变更为"drop database"

# 3. 规格约束

1、部署形态：共享集群  ------注意测试非集群模式下的拦截

2、部署方式：命令行+可视化

3、支持的参数类型：YCS参数（YCS普通参数+YCS心跳参数）+YFS参数（YFS普通参数+YFS建DG相关参数）

4、节点数：以2节点为规格来进行测试即可，和节点数无关

5、不支持的参数：

- YCS级别配置参数：AUTO_START
- YCS级别配置参数"YCR_DISK"通过"  CEDisk  "中的"  vote  "参数来控制
- YCR级别配置参数"VOTE_DISK"通过"  CEDisk  "中的"  ycr  "参数来控制
- YCS级别配置参数"_HOST_NAME"：om内部实现，不提供外部入口（多机多实例使用真实hostname，单机多实例使用"真实hostname+id"拼接的模式）


# 4. 主要应用场景

**主要应用场景：**

1、使用工具进行安装部署时，可自定义ycs/yfs相关参数后进行安装部署，为其提供了入口，无需部署后再次修改，提高了易用性

**和其它特性的关联场景：**

1、考虑该需要兼容性的变更是否会影响升级？，不影响，升级不适用yashandb.toml文件，已和开发确认

2、卸载数据库：卸载数据库时，开发实现层面，从  "yfscmd rm -rf +DG0/dbfiles"变更为"drop database"，需要校验卸载后重装场景

3、非"+DG0/dbfiles"目录下，但是在"+DG0/"目录下的文件的删除，需要校验这类型文件在执行"cluster clean"操作时，是否会清理干净，原则上是会被清理干净

**涉及变更点：**

1、配置文件层面变更：

- 删除"  CEDisk  "中对于"DATA"的设置
- YFS建DG级别配置参数"  YFS_FORCE_CREATE  "移到"  group.diskgroup  "中
- 新增"  group.diskgroup  "选项，并在其中新增YFS建DG级别配置参数，参数列表如下：


```
name = "DG0" # diskgroup的名称
redundancy = "EXTERNAL" # diskgroup的冗余度，EXTERNAL|NORMAL|HIGH，默认为normal
disk_size = "70M" # disk的大小，省略则为该disk的总大小，同一个diskgroup下的所有disk的size是一样的
au_size = "1M" # 磁盘组的分配单元大小，可选值1M、4M、8M、16M、32M，默认为1M
disk = ["/volume1", "/volume2"]  # 一个diskgroup中所有failuregroup下的disk数量必须保持一致
```

- 新增YCS级别配置参数，参数列表如下：


```
LOG_LEVEL 
LOG_NUMBER  
LOG_SIZE 
RESTART_TIMES  
RESTART_INTERVAL 
WAIT_STOP_FIN_TIME
NETWORK_HB_TIMEOUT
DISK_HB_KEEP_ALIVE
```

2、命令行层面变更：

- 新增fg参数（-fg/--failgroup），用来指定在创建DG时所需要的failgroup的数量
- 修改data参数（--data），支持输入多盘，使用逗号分隔，例："  --data /volume1,/volume2,/volume3  "


3、可视化界面变更：

- 各项操作同配置文件层的变更一致


# 5. 概要测试设计

## 5.1 功能测试设计

### 1.说明测试设计的整体思路，明确测试范围，规格限制。可以使用流程图、逻辑覆盖等方法体现测试思路。

**整体思路：**

- 正常按照配置参数的测试方法进行测试，但每一个配置参数的修改都要走安装部署流程，安装部署完成后进行基本业务的下发
- 有强关联的配置参数，需要考虑2个/多个配置参数一起测试
- 部分比较明确的场景，直接针对性构造场景测试即可
- 对于可视化界面测试，和命令行方式结合，在流程走通的前提下，选取部分有代表性的参数进行测试即可，不需要全量测试


**测试方法：**

- 对于每个配置参数的测试，考虑正常的等价类、边界值法进行测试
- 对于部分关联场景，考虑相对明确的场景法和可能出现错误的错误推测法


### 2.关键数据、测试场景的构造方法，用例自动化方法，可能涉及的测试框架说明。

**关键数据/测试场景：**

- 该需要不涉及重量级的关键数据和测试场景构造，相对简单


**用例自动化：**

- 直接使用Guider框架即可


### 3.关联特性：如导入导出、审计、权限等

归档：参考第4部分"和其它特性的关联"模块即可

### 4.分布式、集群、列表不支持的特性，需要考虑补充拦截用例

参考规格约束中的"部署形态"部分即可

## 5.2 DFX测试设计

**资料专项：关注以下两点**

- 该版本本身的资料说明
- 版本变更之后不同版本之间"yashandb.toml"文件内容格式不兼容的相关资料说明


# 6. 测试策略

**自动化看护策略：**

- yasft新增用例文件夹
- 单独新增CI工程看护
- 使用guider框架：shell命令+sql命令结合的方式


**梳理涉及到yasboot安装部署的全量框架，同步各个框架责任人，在需求上车后进行同步适配：**

|框架|框架责任人|是否同步|备注|
|---|---|---|---|
|guider|陈玲玲|  
|  
|
|dfr|吕雷奇|  
|  
|
|集群安装部署和升级框架|李世铭|  
|  
|


# 7. 后续关注(可选)

暂无