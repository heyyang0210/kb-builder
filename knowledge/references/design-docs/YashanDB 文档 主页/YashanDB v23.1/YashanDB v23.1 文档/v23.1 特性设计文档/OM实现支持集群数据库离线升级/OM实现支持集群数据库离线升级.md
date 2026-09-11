Created by 瞿蓝孟 on 八月 07, 2023

## 1. Overview（概述）

当前版本只支持单机和分布式的离线升级，现要实现集群的离线升级；

  


## 2. Features（功能特性）

- ycs/yfs直接进行二进制替换
- db节点按照单机升级流程处理


## 3. Interfaces（接口）

同单机/分布式升级命令一样

- package upgrade 
- cluster upgrade


## 4. Limitations（功能限制）

由于集群暂时没有正式版本，本地先通过修改conf/profile.toml的verions字段来模拟，转测之后修改git仓库的tag来实现版本不一样的情况；

## 5. Detail Design（详细设计）

1. 根据版本号去version.toml（文件在  **YASDB_HOME**  /admin下）找到升级目录
1. pre-check   **执行preupgrade.sql,结果与preupgrade.out对比**   （走upgrade.toml的DN路径）
1. 检查视图，找到要备份的文件路径（具体文件路径见下sql）
1. yasctl stop ycs
1. 备份 --- 控制文件、redo文件、undo表空间、system表空间
1. 将原目录（  **YASDB_HOME**  下）备份到其他目录，将新包解压进来
1. 重新启动（yasctl stop ycs）
1.  db进入upgrade模式（nomount） alter database open upgrade
1. 元数据升级 --- 通过执行  **upgrade.sql**  （随版本发布，可能有多个sql文件，走upgrade.toml的DN路径）,需要检查是否报错
1. **由于检查是用yasql -f upgrade.sql来执行的，需要保存执行结果，并在结果中搜索是否有yasdb的错误码**
1. 退出upgrade模式 --- 数据库正常状态 alter database exit upgrade
1. post-check   **postupgrade.sql,postupgrade.out**  （走upgrade.toml的DN路径）
1. 升级成功，流程结束


### 5.1 Architecture（架构）

架构没有变动，略

## 6. Testcases（自测用例）

*设计开发人员自测用例（文字描述）。*

## 7. Document（资料）

## 8. Workload（工作量）

*评估代码量KLOC、工作量（人天）。*

## 9. TODO（遗留问题）

*说明本方案遗留的问题或下一步需要解决的问题。*