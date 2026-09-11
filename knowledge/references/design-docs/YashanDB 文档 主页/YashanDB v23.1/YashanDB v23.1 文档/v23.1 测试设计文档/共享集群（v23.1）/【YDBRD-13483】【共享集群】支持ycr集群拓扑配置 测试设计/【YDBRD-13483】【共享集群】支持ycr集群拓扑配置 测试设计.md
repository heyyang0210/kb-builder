Created by 张丽红, last modified by  张茜 on 十二月 22, 2023

**SR链接：**    [YDBRD-13483](https://jira.yasdb.com/browse/YDBRD-13483?src=confmacro)    **-**  **【共享集群】支持ycr集群拓扑配置**  **完成**

**               **    [YDBRD-13485](https://jira.yasdb.com/browse/YDBRD-13485?src=confmacro)    **-**  **【共享集群】YCS集群拓扑的配置与查看**  **完成**

**开发设计文档链接：**    [【YCS】崖山集群注册ycr设计方案](109576975.html)  

# **1.概述**

ycr功能，就是将ycs的每个节点的配置信息的公共部分提取出来，统一放到共享磁盘上去配置和管理。这些配置信息，包括集群名称，节点名称，ycs通信地址、ycs管理的资源等等，是构建ycs集群的重要信息。

相当于：在技术项目阶段需要手动配置的"ycsctl.ini"文件，以及"yascs.ini"文件中涉及到的  "RESOURCE1"/"RESOURCE2"/"NODE_ID"/"INTER_URL"等信息，  现在不再需要分别手动写入每个实例的配置文件中进行配置，而是通过ycr机制来实现，做统一管理。

# **2.需求分析**

### **本次ycr支持的功能如下：**

- 支持创建集群
- 支持覆盖原有集群
- 支持增加yasdb资源，并且支持一个node对应多个yasdb实例
- 支持单机多实例场景
- 支持多机多实例场景
- 支持增加节点和ycs互联地址
- 支持查看公共Topo配置
- 支持默认yasfs资源，不需要手工添加


### 涉及到的新增接口如下：

- y  csctl create cluster clustername [-o]


                --创建集群，clustername 是集群名称，-o参数表示覆盖原来的集群，不加的话不覆盖原来的集群，会提示错误

                   初始化时创建好集群，在执行一段时间业务之后，再重新创建集群，这个时候ycr保存的信息还在吗？------这个时候ycr保存的信息会消失，需要重新启动节点之后才可以生效

                   重新"增加资源"/"创建实例"/"增加节点"之后，是否会生效？--------和"创建集群"的机制是一样的，需要重新启动节点之后才会生效，不重新启动不会生效

- ~~ycsctl add res yasdb startshell stopshell monitorshell~~


~~                --为集群添加资源yasdb ，并指定启动脚本startshell，停止脚本stopshell，监控脚本monitorshell~~

- ~~ycsctl add yasdbinstance nodename.instancename~~


~~              --创建yasdb实例，此场景为一个node下面对应多个实例的场景，是个预留的接口~~

~~              --需要先执行ycsctl add node，再执行这条命令，否则报错~~

- ycsctl add yasdbinstance nodename.instancename startshell stopshell monitorshell


              --创建yasdb实例资源，支持在一个nodename下面创建多个instancename（但是yasdb暂不支持，所以单节点多实例场景还只是个预留接口），执行这条命令将会创建一个yasdb资源

              --需要先执行ycsctl add node，再执行这条命令，否则报错

- ycsctl add node nodename yascs_url


                --为集群增加节点，nodename 是节点名称（这里的nodename是指  linux机器的主机名称  ），yascs_url 是ycs互联的地址

- ycsctl show config


               --展示集群topo的配置

示意图如下：实际展示结果中，url信息已经被删除

![](https://pingcode.yasdb.com/atlas/files/public/673969bba1ad9a3311dc78b2/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFCQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDg2MDcsImV4cCI6MTc4MjIxOTQwN30.Zt5dChrUz7fvttVnjiIWmXlbpTNvrdtK3TmJyK-zCHI)

### 使用实例：

ycsctl create cluster yascluster -o    
  ycsctl add res yasfs    
  ycsctl add res yasdb startdb.sh stopdb.sh monitordb.sh    
  ycsctl add node yas1 172.28.226.31:1770    
  ycsctl add node yas2 172.28.226.31:1771    
  ycsctl add yasdbinstance yas1.yasdb

展示集群Topo配置 ycsctl show config

### 对当前已有安装部署的影响：

1、  ycsctl.ini 文件删除

2、节点本地配置文件yascs.ini内容做如下修改：

（1）删除已有配置参数："RESOURCE1"/"RESOURCE2"/"NODE_ID"/"INTER_URL"

（2）新增如下配置参数："_HOSTNAME"/"YCR_DISK"（单机多实例场景下，必须在yascs.ini中配置隐藏参数 _HOSTNAME，多机器场景可不配置）

（3）修改后的yascs.ini文件内容如下：

```
VOTING_DISK=SIMS:/DEV1|16M|4K
YCR_DISK=SIMS:/DEV3|16M|4K
_HOSTNAME=yas1
LOG_LEVEL=DEBUG
AUTO_START=NEVER
```

3、原环境变量"YASCM_HOME"废弃，新增环境变量"YASCS_HOME"（例：YASCS_HOME = /home/yasdb/anchorbase/YASDB_NODE/node0）（  "YASCM_HOME"这个环境变量原来是在哪里用到了？----在ycsctl.ctl文件中的"home"值  ）

4、资源启停脚本的名称保持3个实例上一致

5、新增"资源监控"脚本

6、在ycs启动之前，新增ycr配置相关操作，具体操作如下：

```
ycsctl create cluster yascluster -o
ycsctl add node yas1 172.28.226.31:1770
ycsctl add node yas2 172.28.226.31:1771
ycsctl add yasdbinstance yas1.yasdb startdb.sh stopdb.sh monitordb.sh
ycsctl add yasdbinstance yas2.yasdb startdb.sh stopdb.sh monitordb.sh
```

7、执行ycr配置相关的操作需要提权，"  ~~启动模拟器，~~  提权，配置ycr"操作的先后顺序：  ~~启动模拟器，~~  提权，配置ycr信息，提权的命令如下：

```
sudo setcap cap_sys_rawio=eip /home/yasdb/anchorbase/yasdb_home/bin//ycsctl
```

# **3.规格/范围**

1、部署形态：集群

2、集群节点个数：2节点、3节点无差异

3、集群部署模式：模拟器场景+磁阵场景

4、"1个node对应多个实例"的场景中，对应的实例个数的上限是8   （只是添加）

~~5、~~  ~~ycr盘的大小为1324K-----“~~  ~~**YCR_DISK”中size2的最小值（哪里配置？）**~~

6、  ycr最多支持64个节点  （只是添加）

7、  ycr支持DB一种资源

# **4.约束限制**

1、"  ycsctl add res yasdb startshell stopshell monitorshell  "命令中，  监控脚本monitorshell是预留接口，没有实现真正的监控功能，资料已明确说明。  

2、"ycsctl add res yasdb startshell stopshell monitorshell"命令中，  所有node的三个脚本名称要求一致  （这个要在资料中做说明）

3、"ycsctl add res yasdb startshell stopshell monitorshell"命令中，启停脚本的顺序必须一致  （这个要在资料中做说明）

4、  三个脚本放在YASCS_HOME /scripts/ 路径下  （需要在资料中做说明）

5、"clustername"/"  **_HOSTNAME"**  的命名规则做约束（规格说明补充）。

6、不支持查看每个节点的本地配  置（需要在资料中做说明）

7、  单机多实例场景下，必须在yascs.ini中配置隐藏参数 _HOSTNAME，多机器场景可不配置  （  这个主要是用在模拟器场景中，非商用，不必在资料中做说明  ）

8、"ycsctl add yasdbinstance nodename.instancename"命令中，ycr支持，但是db层面并不支持，  当前的表现：命令层面可以执行成功，能显示配置的信息，但是实际并没有增加成功

9、"  ycsctl add yasdbinstance nodename.instancename  "命令执行的前提是，"  node  "已经创建，否则会报错

10、  ycsctl 工具执行ycr相关的命令时，不支持并发，

11、ycr相关操作执行时，执行失败的场景，比如命令执行过程中掉电之类，这种异常场景不在本次交付范围

12、数据库业务执行/节点启停/资源启停的过程中，不可以进行ycr配置相关的操作。

# **5.动态视图/配置参数**

该需求涉及到的新增配置参数都为"ycs配置参数”，ycs配置参数相关的资料是放在哪里------"安装部署"部分，这部分资料在迭代3增加    


**5.1、新增配置参数“_HOSTNAME”**

这个参数主要用于模拟器场景，不做重点验证，参数基本信息如下：

|参数|参数说明|默认值|取值范围/格式|生效方式|参数类型|备注|
|:---|---|---|---|---|---|:---|
|**_HOSTNAME**|主机名称|无默认值，单机多实例场景下，该参数必须有值|开发设计文档中未做说明|重启生效|隐藏参数|单机多实例场景下，必须在yascs.ini中配置隐藏参数 _HOSTNAME，多机器场景可不配置,隐藏参数 _HOSTNAME，生产场景下，每个服务器运行一个ycs实例，所以ycs与服务器的数量关系是1 : 1，这种场景不需要配置_HOSTNAME，可以通过主机名生成nodeid,在debug场景下，常见单机多实例的场景，如果不配置 _HOSTNAME，就会存在多个ycs实例对应一个主机名称的情况，这个时候，就必须配置_HOSTNAME，生成虚拟的主机名，用于为每个ycs实例分配nodeid,hostname命令规则开发设计文档中未提供，这部分不作为重点测试，模拟器场景不商用|


**5.2、新增配置参数“**  **YCR_DISK**  **”，这个参数重点在磁阵场景下做验证**

|参数|参数说明|默认值|取值范围/格式|生效方式|参数类型|备注|
|:---|---|---|---|---|---|:---|
|**YCR_DISK**|YCR盘信息|无默认值，该参数的值必须配置|盘名称|size|size|重启生效|非隐藏参数|模拟器下格式：  YCR_DISK=    [SIMS:/DEV3|16M|4K](http://SIMS/DEV3|16M|4K)  ,磁阵下格式：  YCR_DISK=  /dev/mapper/02lun32KB    [|16M|4K](http://SIMS/DEV3|16M|4K)  ,格式：盘名  称|size1|size2，size2的最小值是1324K|


# **6.测试设计方法**

这个需求重点测试ycr支持的所有单点功能

### **6.1. ycr基本功能测试**

这部分主要针对ycr支持的每一个单点功能做测试，测试时主要采用场景法和等价类法，，考虑的一些因素和角度如下。针对每种基础场景，要保证每次设置完成后，集群可以启动成功

1、该功能本身的基本场景、语法测试

2、该功能和ycr其它功能之间的交互

3、该功能和数据库业务之间的交互

4、该功能是否涉及到故障相关场景

### **6.2. 配置参数测试**

这个需求主要涉及2个配置参数，都是ycs相关的配置参数，配置参数测试采用公共测试方法即可

### **6.3. 约束限制测试**

这部分针对每个约束限制点，做针对性测试即可，主要使用场景法

# **7.详细测试设计**

[YDBRD-13483-支持ycr集群拓扑配置_测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YmJhMWFkOWEzMzExZGM3OGFlIiwicmVmX2lkIjoiNjczOTY5YmE3MjgyMDZlZmI5MmVmNmIwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4NjA3LCJleHAiOjE3ODIyOTUwMDd9.S7BdMSqK_mt9pvgTdfB0itjayGqYrdRvZ-6FqlpRknU)

# **8.测试用例**

[YDBRD-13483-支持YCR集群拓扑配置_测试用例module_V1.0.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YmI4OTcwYzJhZjRmNTFmYTM5IiwicmVmX2lkIjoiNjczOTY5YmE3MjgyMDZlZmI5MmVmNmIwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4NjA3LCJleHAiOjE3ODIyOTUwMDd9.jjF5evwzu_tCzygKb5NDLS3OcmRrsrpWdmZmSdFPfeE)

# **9.测试框架/测试用例自动化**

TBD

# **10.测试环境说明**

  


# **11.测试版本**

  


## Attachments:

[YDBRD-13478-支持创建集群数据库_测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YmI4OTcwYzJhZjRmNTFmYTNhIiwicmVmX2lkIjoiNjczOTY5YmE3MjgyMDZlZmI5MmVmNmIwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4NjA3LCJleHAiOjE3ODIyOTUwMDd9.0XZBsiS_9SZXm9NYRNUkDOPmoSvFWB102WeAD46Qhhk)

 (application/x-xmind)    


[image2023-5-5_15-14-39.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YmJhMWFkOWEzMzExZGM3OGFmIiwicmVmX2lkIjoiNjczOTY5YmE3MjgyMDZlZmI5MmVmNmIwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4NjA3LCJleHAiOjE3ODIyOTUwMDd9.G9F43myObUmXn-UVuR9-ZaFsuhtuNvylPevjiJLxFmI)

 (image/png)    


[YDBRD-13483-支持ycr集群拓扑配置_测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YmJhMWFkOWEzMzExZGM3OGFlIiwicmVmX2lkIjoiNjczOTY5YmE3MjgyMDZlZmI5MmVmNmIwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4NjA3LCJleHAiOjE3ODIyOTUwMDd9.S7BdMSqK_mt9pvgTdfB0itjayGqYrdRvZ-6FqlpRknU)

 (application/x-xmind)    


[YDBRD-13483-支持YCR集群拓扑配置_测试用例module_V1.0.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YmI4OTcwYzJhZjRmNTFmYTM5IiwicmVmX2lkIjoiNjczOTY5YmE3MjgyMDZlZmI5MmVmNmIwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4NjA3LCJleHAiOjE3ODIyOTUwMDd9.jjF5evwzu_tCzygKb5NDLS3OcmRrsrpWdmZmSdFPfeE)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[ycr质量加固--文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YmJhMWFkOWEzMzExZGM3OGIxIiwicmVmX2lkIjoiNjczOTY5YmE3MjgyMDZlZmI5MmVmNmIwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4NjA3LCJleHAiOjE3ODIyOTUwMDd9.F14ioOsBx5YpDTy-onNH-_o9OLfaac5GJRWioUZpgHY)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


## Comments:

|  [](null)  ,2023/5/8对齐：    
  （1）ycr相关命令执行失败的异常场景，本次不做交付    
  （2）数据库业务执行/节点启停/资源启停的过程中，不可以进行ycr配置相关的操作，需要做拦截，本次交付-----在测试设计评审时修改这一点，不做交付和拦截    
  （3）ycr配置相关的操作本身的并发，会在"节点动态启停"相关的需求中做拦截，本次不做交付    
  （4）"ycsctl show config"的结果，建议提供一个示意图，转测前提供    
  （5）"ycsctl create cluster clustername [-o]"命令中涉及的"clustername"的命名规则需要明确，可参考单机对象命名规则，本次不做交付，作为遗留问题（    [http://cod-doc.yasdb.com/yashandb/alpha/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%9F%BA%E6%9C%ACSQL%E5%85%83%E7%B4%A0/%E6%A0%87%E8%AF%86%E7%AC%A6.html）](http://cod-doc.yasdb.com/yashandb/alpha/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%9F%BA%E6%9C%ACSQL%E5%85%83%E7%B4%A0/%E6%A0%87%E8%AF%86%E7%AC%A6.html）)      
  （6）"ycsctl status"的显示信息中"ver"和"age"的变化规则和对应的操作需要提供可测文档，转测前交付    
  （7）命令变更："ycsctl add res yasdb startdb.sh stopdb.sh monitordb.sh"命令删除，"ycsctl add yasdbinstance nodename.instancename"命令变更为"ycsctl add yasdbinstance nodename.instancename startdb.sh stopdb.sh monitordb.sh",  
,2023/5/10 对齐结论：    
  1、对安装部署的影响方面，"启动模拟器，提权，配置ycr"操作的先后顺序：启动模拟器，提权，配置ycr信息；提权命令：sudo setcap cap_sys_rawio=eip /home/yasdb/anchorbase/yasdb_home/bin//ycsctl    
  2、下面这几种场景，当前不做交付：    
  （1）"ycsctl add node nodename yascs_url"命令中，"在增加node时，node名称错误，url信息正确"，当前未做拦截    
  （2）"ycsctl add node nodename yascs_url"命令中，"在增加node时，node名称正确，url端口被占用"，当前未做拦截    
  （3）"ycsctl add node nodename yascs_url"命令中，"在增加node时，node名称正确，url信息格式错误"，当前未做拦截    
  （4）"ycsctl add yasdbinstance nodename.instancename startshell stopshell monitorshell"命令中，"指定脚本名称时，顺序相反"，当前未拦截    
  3、"_HOSTNAME"配置参数的取值规则设计文档中未做说明，不做测试    
  4、ycs配置参数相关的异常取值的表现，和之前技术项目的表现做对比，根据实际测试情况决定处理策略    
  5、"YCR_DISK"配置参数的取值（格式为"盘名称|size1|size2"），size1可能会在后期去掉，当前重点测size2的取值，size1的取值不做测试,Posted by zhanglihong at 五月 05, 2023 15:55|
|---|
|  [](null)  ,2023/5/15 对齐约束：,1、所有名称类配置参数nodename、instancename、clustername 及_HOSTNAME长度必须在4~64之间，以字母开头，支持字母、数字以及下划线_    
  2、ycs内部通信地址yascs_url 的约束是：有效IP地址+冒号+端口号，中间不能有空格，例如：192.168.1.1:1234    
  3、对于脚本名字的约束是，长度必须在4~64之间，以字母开头，支持字母、数字以及下划线_，必须有扩展名，目前可配置的脚本类型有：sh|pl|py|bat|go|rb|sql，只支持sh和bat，其他只做预留,4、对于YCR_DISK这个参数的校验规则：    
  模拟器固定是 YCR_DISK=    [SIMS:/DEV3|100M](http://SIMS/DEV3|100M)      
  磁阵：YCR_DISK=path|100M    
  100M固定不能变,配置文件不同于100M的取值均会判错。,对于磁阵环境path的值，不校验path是否真的能访问，只校验为合法path。,5、_HOSTNAME重启生效的方式，必须重建ycr，即重新配置一遍ycr，步骤为：,1）停止ycs    
  2）修改_HOSTNAME    
  3)  重建ycr    
  4）启动ycs,Posted by xufanbo at 五月 16, 2023 09:53|
|  [](null)  ,### 质量加固新增场景：,1、ycr各种命令和reboot并发。–不交付,2、数据库业务执行/节点启停/资源启停的过程中，不可以进行格式化集群。--自动化补充即可,3、构造每个ycr命令入参错误，查看报错提示信息是否符号预期，比如：  _HOST_NAME值和add node 不一致，启动报错，查看报错提示 --自动化,4、add yasdbinstance 多实例增加，实例(ycsctl add yasdbinstance nodename.yasdbinstancename )名称命名异常验证（null，空，数字，特殊符号）,5、start脚本中stop instance，stop脚本中start instance ??,6、分别并发add node、add yasdbinstance且增加自动化 --不支持，并发只会成功一个,7、add node增加64个节点，一个节点下add yasdbinstance增加8个，边界值和超出范围       --自动化补充,8、VOTING_DISK、YCR_DISK参数值入参异常拦截（null，空，数字，特殊符号）、磁盘权限异常 --需求    [YDBRD-15223](https://jira.yasdb.com/browse/YDBRD-15223?src=confmacro)    -  【共享集群】voting disk\ycr disk格式化工具  完成  加固时需要补充,9、ycsctl create cluster name -O --异常场景     
      1、DB存在一定数据（ddl、dml后查询DB数据并保留结果），kill -19 挂起所有ycs    
      2、ycsctl create cluster name -O     
      3、add node、add yasdb （增加和之前不同ycr信息）-------增加后查看ycr信息ycsctl show config，和本地ini配置已经不一致，是否需要做到ycr增加配置信息和本地ini校验（目前没有）    
      4、kill -18恢复ycs，db被自动拉起启动成功后，DB数据依旧正常、且和ycr格式化之前一致    
      5、DB dml、ddl    
      gdb方式挂起，步骤相同     --不支持,10、ycsctl create cluster name --异常场景     
      1、DB存在一定数据（ddl、dml后查询DB数据并保留结果），kill -19 挂起所有ycs    
      2、ycsctl create cluster name     
      3、add node、add yasdb （增加和之前不同ycr信息）-------增加后查看ycr信息ycsctl show config，和本地ini配置已经不一致，是否需要做到ycr增加配置信息和本地ini校验（目前没有）    
      4、pkill -9 yascs，启动ycsctl start ycs &启动ycs和db，查看DB数据依旧正常、且和ycr格式化之前一致    
      5、DB dml、ddl    
      gdb方式挂起，步骤相同,ycsctl status,Posted by zhangqian at 十二月 21, 2023 19:58|
|  [](null)  ,一、会议时间：2023/12/22 周五16：00-17:00    
  二、会议地点：线上会议    
  三、会议主持人：张茜    
  四、参会人员：李垠、吕雷奇、张丽红、徐凡博、张茜    
  五、会议主题：【YDBRD-13483】【共享集群】支持ycr集群拓扑配置测试设计--质量加固,会议纪要：    
  1、yasboot工具执行，是否生成"startshell stopshell monitorshell" 脚本（结论：已确认没有生成monitorshell）    
  2、yasboot工具执行，"ycsctl add yasdb startshell stopshell monitorshell" 是否校验脚本存在（结论：已确认不校验）    
  3、"ycsctl add yasdb startshell stopshell monitorshell"命令中，启停脚本的顺序必须一致,遗留问题：    
  第三点，启停脚本的顺序必须一致，需要在资料中做说明。,Posted by zhangqian at 十二月 22, 2023 17:55|
|  [](null)  ,[ycr质量加固--文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YmJhMWFkOWEzMzExZGM3OGIxIiwicmVmX2lkIjoiNjczOTY5YmE3MjgyMDZlZmI5MmVmNmIwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4NjA3LCJleHAiOjE3ODIyOTUwMDd9.F14ioOsBx5YpDTy-onNH-_o9OLfaac5GJRWioUZpgHY),Posted by zhangqian at 一月 11, 2024 17:11|
|  [](null)  ,时间：2024/3/5 周二  9:50-10:50,人员：张丽红、李垠、Trump、徐凡博,结论：,YDBRD-15223【共享集群】voting disk\ycr disk格式化工具     
    [YDBRD-15223](https://jira.yasdb.com/browse/YDBRD-15223?src=confmacro)    -  【共享集群】voting disk\ycr disk格式化工具  完成    
  这个需求，我大概看了一下，从开发设计和测试设计的角度来看的话，本身是一个内部DFX的能力，开发设计很明确，测试设计这边点也很全面，自动化用例维护也是全量的，从测试的角度来考虑，没有其它入口了，没有必要做其他的加固，我的建议是这个需求不做额外的加固，只要保证库上已有的自动化用例不出问题即可，大家觉得呢,Posted by zhanglihong at 三月 05, 2024 09:52|
