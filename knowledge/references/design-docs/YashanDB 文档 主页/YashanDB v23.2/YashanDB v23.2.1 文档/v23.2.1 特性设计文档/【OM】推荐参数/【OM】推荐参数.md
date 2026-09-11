Created by 黄思源, last modified on 九月 12, 2023

#   [推荐参数](#推荐参数)  

##   [1. Overview（概述）](#1-overview概述)  

方便用户将数据库的配置调整至最佳性能。

##   [2. Features（功能特性）](#2-features功能特性)  

1. 部署时提供选项让用户选择是否启用这个功能。部署成功的时候，就是一个最佳的状态。
1. 扩缩容。（不在此迭代完成）


##   [3. Interfaces（接口）](#3-interfaces接口)  

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

1. 资源的分配，依赖于当前集群的节点个数。
1. 数据库最小可用内存为1.5G，最小可用CPU核数为1，如果分配的内存或CPU小于这个规格，则直接报错。
1. 单机的内存分配：内存平均分配。
1. 分布式的内存分配：集群单个MN:单个CN:单个DN=1:3:6，内存不符合的时候，最小不能小于1:1:1。
1. 不支持共享集群。
1. 命令行默认这个功能不启用。
1. 部署时将memory_limit写入yashan.toml，默认由OM进行分配。部署的时候，如果yashan.toml中recommend_param=true，则每个节点都需要指定memory_limit。用户可以自己调整节点所在的主机，以及每个节点的内存上限，但需要保证每台主机所使用的总内存不超过指定的主机内存上限。


##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

###   [5.1 Architecture（架构）](#51-architecture架构)  

###   [5.2 Data Structures & Flow（数据结构与流程）](#52-data-structures--flow数据结构与流程)  

1. **生成hosts.toml和yashan.toml文件**
1. 新增参数    `--recommend-param`    ，    `--memory-limit`    ，    `--table-heap`  
1.   `--recommend-param`    ：是否启用推荐参数。默认为false，该值为true时，后面的才生效。
1.   `--memory-limit`    ：可使用的内存上限，单位是%，默认为80，每一台主机的都是指定的该值，可根据需要动态调整生成的hosts.toml文件。
1.   `--table-type`    ：主要业务的表类型，单机默认是HEAP，分布式默认是LSC，可选值[HEAP,TAC,LSC]。
1. 生成的hosts.toml：
1. yashan.toml也要有recommend_param：
1. **部署主机**
1. 如果hosts.toml中如果指定了recommend_param=true，则表示启用推荐参数功能，memory_limit不能超过这台主机的总内存。
1. **部署数据库**
1. 如果主机启用了推荐参数功能，则需要判断每台主机是否都开启了推荐参数的功能，如果不是，则报错返回。
1. 需要校验yashan.toml文件中所有节点的内存总和是否超过对应主机的memory_limit，如果超配，报错，如果加了--recommend-force，则跳过超配的校验。
1. 在将节点拉到nomount状态之后执行高级包，然后重启节点。


```
$ ./bin/yasboot package config gen -c minidb --ip ip1,ip2 --recommend-param --memory-limit 80 --table-type HEAP

```

```
uuid = "64e5e1bb983cc60d5a7288d31deccee5"
cluster = "minidb"
yas_type = "SE"
recommend_param = true

[om]
  hostid = "host0001"
  [om.config]
    LISTEN_ADDR = "127.0.0.1:1675"

[[host]]
  hostid = "host0001"
  group = "huangsiyuan"
  user = "huangsiyuan"
  ip = "127.0.0.1"
  port = 22
  path = "/home/huangsiyuan/anchorbase/install"
  jvm_path = ""
  # cpu_limit = 1	# CPU核数
  memory_limit = "12693M"
  [host.yasagent]
    [host.yasagent.config]
   LISTEN_ADDR = "127.0.0.1:1676"

```

```
cluster = "minidb"
create_simple_schema = false
recommend_param = true
table_type = "HEAP"
uuid = "64ebf5dd16b8612e17f0a72e1d4528e0"
yas_type = "SE"

[[group]]
  group_type = "mn"
  name = "mng1"
  [group.config]
    CHARACTER_SET = "utf8"
    ISARCHIVELOG = true
    REDO_FILE_NUM = 4
    REDO_FILE_SIZE = "128M"

  [[group.node]]
    data_path = "/home/huangsiyuan/yashandb_home/yashandb/data/minidb"
    hostid = "host0001"
    memory_limit = "1299M"
    role = 1
    [group.node.config]
      DATA_BUFFER_SIZE = "256M"


```

>   Tips:    因为需要先扫描主机再进行内存分配，所以无法通过ssh方式连上远程主机的，则都无法通过规则对节点进行重分配，这时候memory_limit显示为-。  

```
$ yasboot package install -i yashandb-22.2.0.9-linux-x86_64.tar.gz -t hosts.toml

```

>   Tips:    加了-f之后，跳过校验。  

```
$ yasboot cluster deploy -t yashan.toml

```

>   Tips:    1. hosts.toml和yashan.toml的recommend_param都需要为true才可以。
  