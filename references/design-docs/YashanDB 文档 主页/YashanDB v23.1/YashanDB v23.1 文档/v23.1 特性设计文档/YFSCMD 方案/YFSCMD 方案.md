Created by 马勇, last modified by  李佐龙 on 七月 20, 2023

-   [](#YFSCMD方案-)  
-   [1.概述](#YFSCMD方案-1.概述)  
    -   [1.1 约定](#YFSCMD方案-1.1约定)  
-   [2. 功能限制](#YFSCMD方案-2.功能限制)  
    -   [2.1 支持平台](#YFSCMD方案-2.1支持平台)  
    -   [2.2 支持指令](#YFSCMD方案-2.2支持指令)  
-   [3. 详细设计](#YFSCMD方案-3.详细设计)  
    -   [3.1 交互模式和非交互模式](#YFSCMD方案-3.1交互模式和非交互模式)  
        -   [交互模式](#YFSCMD方案-交互模式)  
        -   [非交互模式](#YFSCMD方案-非交互模式)  
    -   [3.2 指令的参数](#YFSCMD方案-3.2指令的参数)  
    -   [3.3 YFSCMD 可选方案](#YFSCMD方案-3.3YFSCMD可选方案)  
        -   [3.3.1 yfs shell 与 命令分离](#YFSCMD方案-3.3.1yfsshell与命令分离)  
            -   [关键流程](#YFSCMD方案-关键流程)  
            -   [参考实例](#YFSCMD方案-参考实例)  
        -   [3.3.2 单体 shell](#YFSCMD方案-3.3.2单体shell)  
            -   [关键流程](#YFSCMD方案-关键流程.1)  
            -   [参考实例](#YFSCMD方案-参考实例.1)  
        -   [3.3.3 方案对比](#YFSCMD方案-3.3.3方案对比)  
        -   [3.3.4 方案结论](#YFSCMD方案-3.3.4方案结论)  
    -   [3.4. 主要工具概设](#YFSCMD方案-3.4.主要工具概设)  
        -   [3.4.1 cd](#YFSCMD方案-3.4.1cd)  
        -   [3.4.2 cp](#YFSCMD方案-3.4.2cp)  
            -   [cpdir](#YFSCMD方案-cpdir)  
            -   [cpfile](#YFSCMD方案-cpfile)  
        -   [3.4.3 du](#YFSCMD方案-3.4.3du)  
            -   [dirsize](#YFSCMD方案-dirsize)  
            -   [filesize](#YFSCMD方案-filesize)  
        -   [3.4.4 ls](#YFSCMD方案-3.4.4ls)  
        -   [3.4.5 mkdir](#YFSCMD方案-3.4.5mkdir)  
        -   [3.4.6 mv](#YFSCMD方案-3.4.6mv)  
        -   [3.4.7 pwd](#YFSCMD方案-3.4.7pwd)  
        -   [3.4.8 rm](#YFSCMD方案-3.4.8rm)  
        -   [3.4.9 vim](#YFSCMD方案-3.4.9vim)  
        -   [3.4.10 md5sum](#YFSCMD方案-3.4.10md5sum)  
-   [4. 规格设计](#YFSCMD方案-4.规格设计)  
    -   [4.1 交互模式](#YFSCMD方案-4.1交互模式)  
        -   [4.1.1 交互模式 Interactive Mode](#YFSCMD方案-4.1.1交互模式InteractiveMode)  
        -   [4.1.2 非交互模式 Noninteractive](#YFSCMD方案-4.1.2非交互模式Noninteractive)  
        -   [4.1.3 日志](#YFSCMD方案-4.1.3日志)  
    -   [4.2 指令](#YFSCMD方案-4.2指令)  
        -   [4.2.1 cd](#YFSCMD方案-4.2.1cd)  
        -   [4.2.2 cp](#YFSCMD方案-4.2.2cp)  
        -   [4.2.3 du](#YFSCMD方案-4.2.3du)  
        -   [4.2.4 ls](#YFSCMD方案-4.2.4ls)  
        -   [4.2.5 mkdir](#YFSCMD方案-4.2.5mkdir)  
        -   [4.2.6 mv](#YFSCMD方案-4.2.6mv)  
        -   [4.2.7 pwd](#YFSCMD方案-4.2.7pwd)  
        -   [4.2.8 rm](#YFSCMD方案-4.2.8rm)  
        -   [4.2.9 touch](#YFSCMD方案-4.2.9touch)  
        -   [4.2.10 vim](#YFSCMD方案-4.2.10vim)  
        -   [4.2.11 md5sum](#YFSCMD方案-4.2.11md5sum)  
        -   [4.2.12 cat](#YFSCMD方案-4.2.12cat)  
        -   [4.2.13 bash](#YFSCMD方案-4.2.13bash)  
        -   [4.2.14 help](#YFSCMD方案-4.2.14help)  
    -   [4.3 高级特性](#YFSCMD方案-4.3高级特性)  
        -   [4.3.1 自动补全](#YFSCMD方案-4.3.1自动补全)  
        -   [4.3.2 提示](#YFSCMD方案-4.3.2提示)  
        -   [4.3.3 高亮](#YFSCMD方案-4.3.3高亮)  
-   [5. 测试用例](#YFSCMD方案-5.测试用例)  
    -   [5.1 文件操作](#YFSCMD方案-5.1文件操作)  
    -   [5.2 目录操作](#YFSCMD方案-5.2目录操作)  
-   [6. 工作量](#YFSCMD方案-6.工作量)  
-   [7. TODO](#YFSCMD方案-7.TODO)  


# 1.概述

YFS 不是常规文件系统，因此需要一组管理工具，实现对 YFS 基本的管理，如文件、目录的增删改查。

参考 Oracle ASM 对应的工具 ASMCMD，暂时命名其为 YFSCMD。

YFSCMD 提供 2 种操作模式

- 交互模式，自行实现一个简单的 Shell 环境；
- 非交互模式，直接调用 YFSCMD 中的工具（或指令）。


## 1.1 约定

为减少不必要的误解，约定一些术语：

- YFSCMD 是一个单体工具，但是在设计中依然将其分离为 2 部分：
    - **shell**  ：负责交互和执行环境的。
    - **命令 **  或    **cmd**  ：实现具体功能。
- shell 和 命令都支持一些参数和选项：
    - **选项 **  或   **option**  ：如 -h 或者 -h localhost。
    - **参数 **  或  ** arg**  ：除选项外，如 cd +some/path.


另外，YFSCMD 的实际开发进度可能滞后于本文档，目前不支持任何选项，仅通过参数，实现基本功能。

# 2. 功能限制

YFSCMD 提供了丰富的特性，目前 YFS 处于开发初期，仅设计部分功能。

~~删除线标注暂时不做或做不了。~~

- ~~Oracle ASM interfaces,~~
- ~~disk group,~~
- ~~file access control for disk groups,~~
- files and directories with disk groups,
- ~~templates for disk groups,~~
- ~~volumes~~


目前 YFSCMD 实现基本的文件和目录管理功能

## 2.1 支持平台

- [x] Linux   

- [ ] Windows   

- [ ] Mac   

## 2.2 支持指令

~~删除线标注暂时不做或做不了。~~

- cd                            //用于切换目录
- cp                            // 复制文件，可能在 ext4 和 yfs 之间交叉复制
- du                            //显示磁盘空间的使用情况
- ~~find                          //用于查找文件~~
- help                         //用于显示YFSCMD的所有命令     
- ls                             //显示目录下的内容
- ~~lsct                          //显示目录连接的数据库实例~~
- ~~lsdg                         //显示已挂载的磁盘组~~
- ~~mkalias                   //创建一个系统产生的文件的别名~~
- mkdir                      //创建asm目录
- mv                          // 移动或重命名对象
- pwd                        //显示当前目录的路径
- rm                          //删除目录或文件，如果是别名，会删除别名和别名所对应的文件 /只能删除空目录/
- ~~rmalias                   //删除指定的别名~~


附加指令：

- touch                    // 创建空白文件
- vim                       // 编辑文件
- cat                        // 读取文件到标准输出，可通过管道重定向到其他工具
- md5sum              // 校验文件


# 3. 详细设计

## 3.1 交互模式和非交互模式

### 交互模式

./yfscmd 进入 yfs shell。

标准输出提示：

/yfs/working/dir/path #

输入指令，打印输出后，停留在 yfs shell；

输入退出指令，比如 exit 退出 yfs shell，回到 Linux shell。

### 非交互模式

Linux shell 下直接调用特定工具，比如

client $: /yfsasm/tools/ls +diskgroup1/file/path

输出结果后，返回 Linux shell。

## 3.2 指令的参数

这里以非交互模式说明参数要求，交互模式由 shell 自身调整参数，以符合指令的参数规范要求。

- 所有 path 仅接受绝对路径，交互模式下的相对路径，由 yfs shell 自行转换为绝对路径；
- 采用 POSIX 标准的参数，比如 -h 和 --help；


$PWD 由 shell 自行维护，交互模式下 shell 负责将相对路径转换为绝对路径，传入指令。

  


## 3.3 YFSCMD 可选方案

### 3.3.1 yfs shell 与 命令分离

![](https://pingcode.yasdb.com/atlas/files/public/67396aefa1ad9a3311dc7e71/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFJQUNBSUFBUUNBQUFDQUFSQUFBQUFGQUFRZ0NBQUFBQUFRQUFBQUFBQkFBQUFBQUFCQUFBQUFBQUFBZ0NDTklRZ0FFQVFxQUFBRUFBQUNBQUFBUUFBSUlUQUlBQUFRSVFBQUFDTUFBQ1VCQUFBb0FnQklBQUFBZ1VBQU1CQUFBZ2hBQUNBQUFBQUNBQUJnUUFDSUFBQUFHZ0NBQUlCQUFBRUFLQUFBSWdBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTAyMTksImV4cCI6MTc4MjMwMTAxOX0.h91m_RTM---J26g2F-erqKJNTjPGd29kWFQf0XdXX8w)

采用 Linux shell 设计思想，YFSCMD仅提供 shell 环境，具体功能由各命令实现。

各命令实际上为 YFS 的客户端应用，通过 yfs client lib 与 yfs 交互。

#### 关键流程

![](https://pingcode.yasdb.com/atlas/files/public/67396aef8970c2af4f51fffd/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFJQUNBSUFBUUNBQUFDQUFSQUFBQUFGQUFRZ0NBQUFBQUFRQUFBQUFBQkFBQUFBQUFCQUFBQUFBQUFBZ0NDTklRZ0FFQVFxQUFBRUFBQUNBQUFBUUFBSUlUQUlBQUFRSVFBQUFDTUFBQ1VCQUFBb0FnQklBQUFBZ1VBQU1CQUFBZ2hBQUNBQUFBQUNBQUJnUUFDSUFBQUFHZ0NBQUlCQUFBRUFLQUFBSWdBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTAyMTksImV4cCI6MTc4MjMwMTAxOX0.h91m_RTM---J26g2F-erqKJNTjPGd29kWFQf0XdXX8w)

  


![](https://pingcode.yasdb.com/atlas/files/public/67396aefa1ad9a3311dc7e72/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFJQUNBSUFBUUNBQUFDQUFSQUFBQUFGQUFRZ0NBQUFBQUFRQUFBQUFBQkFBQUFBQUFCQUFBQUFBQUFBZ0NDTklRZ0FFQVFxQUFBRUFBQUNBQUFBUUFBSUlUQUlBQUFRSVFBQUFDTUFBQ1VCQUFBb0FnQklBQUFBZ1VBQU1CQUFBZ2hBQUNBQUFBQUNBQUJnUUFDSUFBQUFHZ0NBQUlCQUFBRUFLQUFBSWdBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTAyMTksImV4cCI6MTc4MjMwMTAxOX0.h91m_RTM---J26g2F-erqKJNTjPGd29kWFQf0XdXX8w)

上图是 YFSCMD 目录结构的一种可能。

Shell 与 命令分离，可以复用 Linux Shell 实现一些工具。

![](https://pingcode.yasdb.com/atlas/files/public/67396aefa1ad9a3311dc7e73/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFJQUNBSUFBUUNBQUFDQUFSQUFBQUFGQUFRZ0NBQUFBQUFRQUFBQUFBQkFBQUFBQUFCQUFBQUFBQUFBZ0NDTklRZ0FFQVFxQUFBRUFBQUNBQUFBUUFBSUlUQUlBQUFRSVFBQUFDTUFBQ1VCQUFBb0FnQklBQUFBZ1VBQU1CQUFBZ2hBQUNBQUFBQUNBQUJnUUFDSUFBQUFHZ0NBQUlCQUFBRUFLQUFBSWdBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTAyMTksImV4cCI6MTc4MjMwMTAxOX0.h91m_RTM---J26g2F-erqKJNTjPGd29kWFQf0XdXX8w)

上图为支持 yfs 文件的 md5sum 的实现思路。

![](https://pingcode.yasdb.com/atlas/files/public/67396aef8970c2af4f51fffe/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFJQUNBSUFBUUNBQUFDQUFSQUFBQUFGQUFRZ0NBQUFBQUFRQUFBQUFBQkFBQUFBQUFCQUFBQUFBQUFBZ0NDTklRZ0FFQVFxQUFBRUFBQUNBQUFBUUFBSUlUQUlBQUFRSVFBQUFDTUFBQ1VCQUFBb0FnQklBQUFBZ1VBQU1CQUFBZ2hBQUNBQUFBQUNBQUJnUUFDSUFBQUFHZ0NBQUlCQUFBRUFLQUFBSWdBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTAyMTksImV4cCI6MTc4MjMwMTAxOX0.h91m_RTM---J26g2F-erqKJNTjPGd29kWFQf0XdXX8w)

上图为 YFS ↔ YFS， YFS ↔ EXTS 复制命令的一种实现思路。

#### 参考实例

Linux Bash， gitshell 均类似：

- shell 程序提供环境；
- 命令通常由特定路径下的一组小工具实现，比如 /bin、/usr/bin 下的那些工具。


### 3.3.2 单体 shell

![](https://pingcode.yasdb.com/atlas/files/public/67396aefa1ad9a3311dc7e74/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFJQUNBSUFBUUNBQUFDQUFSQUFBQUFGQUFRZ0NBQUFBQUFRQUFBQUFBQkFBQUFBQUFCQUFBQUFBQUFBZ0NDTklRZ0FFQVFxQUFBRUFBQUNBQUFBUUFBSUlUQUlBQUFRSVFBQUFDTUFBQ1VCQUFBb0FnQklBQUFBZ1VBQU1CQUFBZ2hBQUNBQUFBQUNBQUJnUUFDSUFBQUFHZ0NBQUlCQUFBRUFLQUFBSWdBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTAyMTksImV4cCI6MTc4MjMwMTAxOX0.h91m_RTM---J26g2F-erqKJNTjPGd29kWFQf0XdXX8w)

所有工具聚合在 shell 中，作为 shell 的 sub cmd。

#### 关键流程

![](https://pingcode.yasdb.com/atlas/files/public/67396aefa1ad9a3311dc7e75/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFJQUNBSUFBUUNBQUFDQUFSQUFBQUFGQUFRZ0NBQUFBQUFRQUFBQUFBQkFBQUFBQUFCQUFBQUFBQUFBZ0NDTklRZ0FFQVFxQUFBRUFBQUNBQUFBUUFBSUlUQUlBQUFRSVFBQUFDTUFBQ1VCQUFBb0FnQklBQUFBZ1VBQU1CQUFBZ2hBQUNBQUFBQUNBQUJnUUFDSUFBQUFHZ0NBQUlCQUFBRUFLQUFBSWdBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTAyMTksImV4cCI6MTc4MjMwMTAxOX0.h91m_RTM---J26g2F-erqKJNTjPGd29kWFQf0XdXX8w)

单体 shell 也可以提供：

- 交互模式， ./yfscmd
- 非交互模式, ./yfscmd cmd args


#### 参考实例

YFSCMD 为单体应用。

git 命令也是一个单体终端应用，可以：

- 交互模式运行 git add -i


![](https://pingcode.yasdb.com/atlas/files/public/67396aefa1ad9a3311dc7e76/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFJQUNBSUFBUUNBQUFDQUFSQUFBQUFGQUFRZ0NBQUFBQUFRQUFBQUFBQkFBQUFBQUFCQUFBQUFBQUFBZ0NDTklRZ0FFQVFxQUFBRUFBQUNBQUFBUUFBSUlUQUlBQUFRSVFBQUFDTUFBQ1VCQUFBb0FnQklBQUFBZ1VBQU1CQUFBZ2hBQUNBQUFBQUNBQUJnUUFDSUFBQUFHZ0NBQUlCQUFBRUFLQUFBSWdBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTAyMTksImV4cCI6MTc4MjMwMTAxOX0.h91m_RTM---J26g2F-erqKJNTjPGd29kWFQf0XdXX8w)

- 非交互模式 git add file.txt


### 3.3.3 方案对比

|方案|文件数量|复杂度|健壮性|可扩展性|Linux Shell 友好|与 ASMCMD 一致|能否支持单次认证（如有必要）|
|---|---|---|---|---|---|---|---|
|分离|多，一个命令一个可执行文件|低，Shell、命令均只实现特定功能|高，部分命令异常不影响其他|较好，设计合理的情况下，新增命令文件即可。|较好，调用 yfs cmd 与其他 Linux 指令相同，方便编写 Linux Shell 脚本。|否|否|
|单体|只有 1 个|较高，随着命令增加，内部交叉关系复杂|较低，局部 Crash 可能造成 Shell 崩溃|一般，重新编码，整体编译|需以 sub cmd 形式提供，但复杂度增加不多。|是|是|


两种方案的主要差异在复杂度、健壮性和可扩展性上。

目前推荐 Shell 与工具分离的方案，该方案具备良好的局部性，各工具专注实现自身功能，工具复杂度不随工具数量而增加，开发和代码管理都更简单，也可以通过管道组合多种工具（不限于 yfs cmd）得到更多工具。

如需要与 ASMCMD  保持兼容，则推荐单体模式，另外如果 YFS 有支持认证的计划，且认证过程成本较高，则首选单体模式，以复用认证链接。

或者，目前处于开发阶段，先采用分离模式，便于调整，后期工具组稳定后再合并为单体工具。

### 3.3.4 方案结论

经 DRB 评审，YFSCMD 选定方案 2，开发原则：

1. 采用单体模式，
1. 使用惯例尽量与 Oracle ASMCMD 保持一致。


## 3.4. 主要工具概设

Continue 和 Quit 表示 read_next_xxx 循环操作，简化流程图。

### 3.4.1 cd

![](https://pingcode.yasdb.com/atlas/files/public/67396aef8970c2af4f51ffff/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFJQUNBSUFBUUNBQUFDQUFSQUFBQUFGQUFRZ0NBQUFBQUFRQUFBQUFBQkFBQUFBQUFCQUFBQUFBQUFBZ0NDTklRZ0FFQVFxQUFBRUFBQUNBQUFBUUFBSUlUQUlBQUFRSVFBQUFDTUFBQ1VCQUFBb0FnQklBQUFBZ1VBQU1CQUFBZ2hBQUNBQUFBQUNBQUJnUUFDSUFBQUFHZ0NBQUlCQUFBRUFLQUFBSWdBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTAyMTksImV4cCI6MTc4MjMwMTAxOX0.h91m_RTM---J26g2F-erqKJNTjPGd29kWFQf0XdXX8w)

$pwd 为 Shell 的全局变量，记录当前工作路径。

该指令在 Linux Shell 下无意义。

### 3.4.2 cp

![](https://pingcode.yasdb.com/atlas/files/public/67396aef8970c2af4f520000/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFJQUNBSUFBUUNBQUFDQUFSQUFBQUFGQUFRZ0NBQUFBQUFRQUFBQUFBQkFBQUFBQUFCQUFBQUFBQUFBZ0NDTklRZ0FFQVFxQUFBRUFBQUNBQUFBUUFBSUlUQUlBQUFRSVFBQUFDTUFBQ1VCQUFBb0FnQklBQUFBZ1VBQU1CQUFBZ2hBQUNBQUFBQUNBQUJnUUFDSUFBQUFHZ0NBQUlCQUFBRUFLQUFBSWdBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTAyMTksImV4cCI6MTc4MjMwMTAxOX0.h91m_RTM---J26g2F-erqKJNTjPGd29kWFQf0XdXX8w)

递归发生在 cpdir 中。 

  


#### cpdir

![](https://pingcode.yasdb.com/atlas/files/public/67396af0a1ad9a3311dc7e77/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFJQUNBSUFBUUNBQUFDQUFSQUFBQUFGQUFRZ0NBQUFBQUFRQUFBQUFBQkFBQUFBQUFCQUFBQUFBQUFBZ0NDTklRZ0FFQVFxQUFBRUFBQUNBQUFBUUFBSUlUQUlBQUFRSVFBQUFDTUFBQ1VCQUFBb0FnQklBQUFBZ1VBQU1CQUFBZ2hBQUNBQUFBQUNBQUJnUUFDSUFBQUFHZ0NBQUlCQUFBRUFLQUFBSWdBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTAyMTksImV4cCI6MTc4MjMwMTAxOX0.h91m_RTM---J26g2F-erqKJNTjPGd29kWFQf0XdXX8w)

#### cpfile

同时打开 2 个文件，一读一写，流程比较简单。

  


### 3.4.3 du

![](https://pingcode.yasdb.com/atlas/files/public/67396af0a1ad9a3311dc7e78/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFJQUNBSUFBUUNBQUFDQUFSQUFBQUFGQUFRZ0NBQUFBQUFRQUFBQUFBQkFBQUFBQUFCQUFBQUFBQUFBZ0NDTklRZ0FFQVFxQUFBRUFBQUNBQUFBUUFBSUlUQUlBQUFRSVFBQUFDTUFBQ1VCQUFBb0FnQklBQUFBZ1VBQU1CQUFBZ2hBQUNBQUFBQUNBQUJnUUFDSUFBQUFHZ0NBQUlCQUFBRUFLQUFBSWdBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTAyMTksImV4cCI6MTc4MjMwMTAxOX0.h91m_RTM---J26g2F-erqKJNTjPGd29kWFQf0XdXX8w)

递归发生在 dirsize 中 。

#### dirsize

![](https://pingcode.yasdb.com/atlas/files/public/67396af08970c2af4f520001/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFJQUNBSUFBUUNBQUFDQUFSQUFBQUFGQUFRZ0NBQUFBQUFRQUFBQUFBQkFBQUFBQUFCQUFBQUFBQUFBZ0NDTklRZ0FFQVFxQUFBRUFBQUNBQUFBUUFBSUlUQUlBQUFRSVFBQUFDTUFBQ1VCQUFBb0FnQklBQUFBZ1VBQU1CQUFBZ2hBQUNBQUFBQUNBQUJnUUFDSUFBQUFHZ0NBQUlCQUFBRUFLQUFBSWdBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTAyMTksImV4cCI6MTc4MjMwMTAxOX0.h91m_RTM---J26g2F-erqKJNTjPGd29kWFQf0XdXX8w)

#### filesize

![](https://pingcode.yasdb.com/atlas/files/public/67396af08970c2af4f520002/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFJQUNBSUFBUUNBQUFDQUFSQUFBQUFGQUFRZ0NBQUFBQUFRQUFBQUFBQkFBQUFBQUFCQUFBQUFBQUFBZ0NDTklRZ0FFQVFxQUFBRUFBQUNBQUFBUUFBSUlUQUlBQUFRSVFBQUFDTUFBQ1VCQUFBb0FnQklBQUFBZ1VBQU1CQUFBZ2hBQUNBQUFBQUNBQUJnUUFDSUFBQUFHZ0NBQUlCQUFBRUFLQUFBSWdBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTAyMTksImV4cCI6MTc4MjMwMTAxOX0.h91m_RTM---J26g2F-erqKJNTjPGd29kWFQf0XdXX8w)

  


### 3.4.4 ls

![](https://pingcode.yasdb.com/atlas/files/public/67396af0a1ad9a3311dc7e79/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFJQUNBSUFBUUNBQUFDQUFSQUFBQUFGQUFRZ0NBQUFBQUFRQUFBQUFBQkFBQUFBQUFCQUFBQUFBQUFBZ0NDTklRZ0FFQVFxQUFBRUFBQUNBQUFBUUFBSUlUQUlBQUFRSVFBQUFDTUFBQ1VCQUFBb0FnQklBQUFBZ1VBQU1CQUFBZ2hBQUNBQUFBQUNBQUJnUUFDSUFBQUFHZ0NBQUlCQUFBRUFLQUFBSWdBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTAyMTksImV4cCI6MTc4MjMwMTAxOX0.h91m_RTM---J26g2F-erqKJNTjPGd29kWFQf0XdXX8w)

### 3.4.5 mkdir

直接调用 mkdir 接口。

### 3.4.6 mv

直接调用 rename 接口。

### 3.4.7 pwd

返回 YFSCMD 的全局变量 $pwd.

### 3.4.8 rm

![](https://pingcode.yasdb.com/atlas/files/public/67396af08970c2af4f520003/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFJQUNBSUFBUUNBQUFDQUFSQUFBQUFGQUFRZ0NBQUFBQUFRQUFBQUFBQkFBQUFBQUFCQUFBQUFBQUFBZ0NDTklRZ0FFQVFxQUFBRUFBQUNBQUFBUUFBSUlUQUlBQUFRSVFBQUFDTUFBQ1VCQUFBb0FnQklBQUFBZ1VBQU1CQUFBZ2hBQUNBQUFBQUNBQUJnUUFDSUFBQUFHZ0NBQUlCQUFBRUFLQUFBSWdBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTAyMTksImV4cCI6MTc4MjMwMTAxOX0.h91m_RTM---J26g2F-erqKJNTjPGd29kWFQf0XdXX8w)

rmdir 接口仅删除空目录，否则抛出异常。

### 3.4.9 vim

![](https://pingcode.yasdb.com/atlas/files/public/67396af08970c2af4f520004/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFJQUNBSUFBUUNBQUFDQUFSQUFBQUFGQUFRZ0NBQUFBQUFRQUFBQUFBQkFBQUFBQUFCQUFBQUFBQUFBZ0NDTklRZ0FFQVFxQUFBRUFBQUNBQUFBUUFBSUlUQUlBQUFRSVFBQUFDTUFBQ1VCQUFBb0FnQklBQUFBZ1VBQU1CQUFBZ2hBQUNBQUFBQUNBQUJnUUFDSUFBQUFHZ0NBQUlCQUFBRUFLQUFBSWdBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTAyMTksImV4cCI6MTc4MjMwMTAxOX0.h91m_RTM---J26g2F-erqKJNTjPGd29kWFQf0XdXX8w)

仅允许编辑 YFS 内的文件，原理是自动将 YFS 的文件复制到 /tmp 目录下，打开 vim 编辑，编辑完后再复制回 YFS。

目前 YFSCMD 对超过 8M 的文件的编辑请求，需用户确认，避免意外编辑超大文件，挤占 YFS server 服务带宽。

当文件编辑完毕，YFSCMD 会提示 ”是否覆盖文件“，如没有编辑或放弃编辑，选择 ”n“ 即可丢弃结果。

### 3.4.10 md5sum

与以下命令等效:

```
# yfscmd cat file | md5sum
```

# 4. 规格设计

## 4.1 交互模式

### 4.1.1 交互模式 Interactive Mode

提供与 Linux Shell 类似的执行环境，用户根据提示输入指令，获得实时输出，指令执行完毕后继续下一跳指令。

支持的选项，在启动 YFSCMD 时指定：

|选项|说明|
|---|---|
|-D|指定 YASFS_HOME，你也可以设置环境变量 $YASFS_HOME，但 -D 的优先级比环境变量更高。|
|-p|在 YFSCMD shell 的提示符中显示当前工作路径。|
|-L|指定日志级别，可选 TRACE|DEBUG|INFO|WARN|ERROR|FATAL|ALL|OFF|


YFS 架构与 ASM 不同，暂时不支持管理远程主机，仅能管理本地 YFS。

指令可以接受相对或绝对路径。

YFSCMD 会通过以下公式计算文件对象的绝对路径：

*AbsolutePath = ProcessWorkingDir + RelativePath*

### 4.1.2 非交互模式 Noninteractive

非交互模式相当于在交互模式下执行 1 个指令，输出结果后退出。

非交互模式通常用于 Linux Shell 脚本。

支持的选项：

|选项|说明|
|---|---|
|-H|显示帮助|
|-V|显示版本号|
|-L|指定日志级别，可选 TRACE|DEBUG|INFO|WARN|ERROR|FATAL|ALL|OFF|


**注意**  ：所有路径参数都必须为绝对路径。

可以通过 Shell 返回值确认命令执行状态（与 ASMCMD 一致）：

|Type|Return Code|Description|
|:---|:---|:---|
|General|0|正常。|
|General|1|内部异常。|
|General|255 (or -1)|用户输入错误，通常会有错误提示。|


非交互模式下，指令调用惯例（与 ASMCMD一致）：

```
yfscmd cmd [options ...]
```

### 4.1.3 日志

yfscmd 的日志保存在 YASFS_HOME/yfscmd.log，日志级别通过 -L 指定，可选 TRACE|DEBUG|INFO|WARN|ERROR|FATAL|ALL|OFF。

## 4.2 指令

所有路径参数都可以是：

- 绝对路径
- 或相对路径


但相对路径默认为 YFS 路径，如需指定操作系统文件路径，请使用 '/' 为第一个字符的绝对路径。

注意，  **文件对象**  指 YFS 支持的任何文件类型：

- 普通文件
- 目录


### 4.2.1 cd

切换当前工作路径。

非交互模式下，该指令无实际意义。

```
cd [dir]
```

|Option|Description|
|---|---|
|dir|目录名.|


不指定参数时，不切换工作路径。

```
YFSCMD [+data/] > cd +data/yas_dbl 
YFSCMD [+data/yas_db] > cd DATAFILE 
YFSCMD [+data/yas_db/DATAFILE] > cd ..
YFSCMD [+data/yas_db] >
```

### 4.2.2 cp

复制  **文件。**

```
cp src_file tgt_file
```

|Option|Description|
|---|---|
|src_file|源文件名|
|tgt_file|目标位置|


复制文件时，不允许覆盖已有文件对象（不得重名）。

所有相对路径一律被转换为 YFS 路径，操作系统文件路径仅支持绝对路径。

src_file、  tgt_file 至少 1 个为   YFS 对象，允许的复制方向：

- ~~ASM 不支持跨磁盘组复制，YFS 尚未开发磁盘组特性，跨磁盘组复制行为目前未定义。~~
- YFS → 操作系统；
- YFS → YFS;
- 操作系统 → YFS;


```
YFSCMD [+] > cp +data/yas_db/datafile/EXAMPLE /yas_backups/example.bak 
copying +data/yas_db/datafile/EXAMPLE --> /yas_backups/example.bak 
YFSCMD [+] > cp /yas_backups/example.bak  +data/yas_db/datafile/EXAMPLE 
copying /yas_backups/example.bak  --> +data/yas_db/datafile/EXAMPLE
YFSCMD [+] > cp +data/yas_db/datafile/EXAMPLE +data/yas_db/datafile/EXAMPLE2 
copying +data/yas_db/datafile/EXAMPLE --> +data/yas_db/datafile/EXAMPLE2
```

### 4.2.3 du

递归计算目录所包含的所有对象大小，当参数为文件时计算文件大小，注意，系统会自动适应文件大小单位，可能为 Bytes、KB、MG、GB 之一  **。**

```
du [--suppressheader] [dir]
```

|Option|Description|
|:---|:---|
|dir|目录|
|suppressheader|不显示标题|


如果不指定 dir，则计算当前路径。

```
YFSCMD [+] > du data/yas_db
Used_MB
100
```

### 4.2.4 ls

列出 YFS 对象清单  **。**

```
ls [--suppressheader] [-lsdt] [--reverse] [pattern]
```

|Option|Description|
|:---|:---|
|(none)|显示文件和目录名称.|
|  `-l`  |显示扩展信息,：,- 类型：目录或文件；
- 创建时间
|
|  `-s`  |显示空间信息。|
|  `-d`  |如果命令路径是一个目录对象，那么显示目录自身的信息，而不是目录内容清单。|
|  `--reverse`  |逆序。|
|  `-t`  |按时间戳排序，而非文件名。|
|  `--suppressheader`  |不显示标题。|
|pattern|文件或者目录。|


  


如果不指定   pattern  ，则计算当前路径。

仅支持 YFS 路径。

```
YFSCMD [+] > ls +data/yas_db
EXAMPLE.1
EXAMPLE.2
EXAMPLE.3
YFSCMD [+] > ls -lt +data/yas_db
Type    Time             Name
FILE    JUL 13 08:00:00  EXAMPLE.1
FILE    JUL 13 08:01:00  EXAMPLE.2
FILE    JUL 13 08:02:00  EXAMPLE.3
DIR     JUL 13 08:03:00  SUBDIR
YFSCMD [+] > ls -s +data/yas_db
Block_Size  Blocks      Bytes       Name
8M          16          9400000     EXAMPLE.1
8M          16          9400000     EXAMPLE.2
8M          16          9400000     EXAMPLE.3
8M          0           0           SUBDIR
```

### 4.2.5 mkdir

创建目录  **。**

```
mkdir dir [dir]
```

|Option|Description|
|:---|:---|
|dir|创建的目录名.|


仅支持 YFS 路径，新的目录名不得与现有文件对象重名，其所有父目录均必须存在。

允许指定多个目录，一次性创建这些目录。

```
YFSCMD [+] > mkdir +data/yas_db/SUBDIR1

YFSCMD [+] > ls -lt +data/yas_db
Type    Time       Name
FILE    JUL 13 08:00:00  EXAMPLE.1
FILE    JUL 13 08:01:00  EXAMPLE.2
FILE    JUL 13 08:02:00  EXAMPLE.3
DIR    JUL 13 08:03:00  SUBDIR
DIR    JUL 13 08:03:00  SUBDIR1
```

### 4.2.6 mv

重命名文件对象  **。**

ASMCMD 中类似命令为 mvfile，涉及   disk group，YFS 目前不支持  。

```
mv src dst
```

|Option|Description|
|:---|:---|
|src|原路径.|
|dst|目标路径|


仅支持 YFS 路径，新的目录名不得与现有文件对象重名，其所有父目录均必须存在。

```
YFSCMD [+] > cd +data/yas_db/

YFSCMD [+data/yas_db/] > ls
EXAMPLE.1
EXAMPLE.2
EXAMPLE.3

YFSCMD [+data/yas_db/] > mv EXAMPLE.3 EXAMPLE.BK

YFSCMD [+data/yas_db/] > ls
EXAMPLE.1
EXAMPLE.2
EXAMPLE.BK
```

### 4.2.7 pwd

打印当前工作路径  **。**

```
pwd
```

一定为 YFS 的绝对路径。

```
YFSCMD [+] > pwd
+
YFSCMD [+] > cd +data/yas_db/

YFSCMD [+data/yas_db/] > pwd
+data/yas_db/
```

### 4.2.8 rm

删除文件对象  **。**

```
rm [-f|-r] pattern [pattern...]
```

|Option|Description|
|:---|:---|
|-f|直接删除，无需交互确认。|
|-r|递归删除。|
|pattern|文件对象名或者路径。|


仅支持 YFS 路径。

除非有参数 -r，否则无法删除空目录。

一定为 YFS 的绝对路径。

```
YFSCMD [+] > cd +data/yas_db/

YFSCMD [+data/yas_db/] > ls
EXAMPLE.1
EXAMPLE.2
EXAMPLE.3
YFSCMD [+data/yas_db/] > rm -rf EXAMPLE.1 EXAMPLE.2
EXAMPLE.1
EXAMPLE.2
EXAMPLE.3
YFSCMD [+data/yas_db/] > ls
EXAMPLE.3
```

### 4.2.9 touch

删除文件对象  **。**

```
touch file
```

|Option|Description|
|:---|:---|
|file|文件路径。|


仅支持 YFS 路径。

```
YFSCMD [+] > cd +data/yas_db/

YFSCMD [+data/yas_db/] > ls
EXAMPLE.1
EXAMPLE.2
EXAMPLE.3
YFSCMD [+data/yas_db/] > touch EXAMPLE.4

YFSCMD [+data/yas_db/] > ls
EXAMPLE.1
EXAMPLE.2
EXAMPLE.3
EXAMPLE.4
```

### 4.2.10 vim

编辑文件  **。**

```
vim file
```

|Option|Description|
|:---|:---|
|file|文件路径。|


仅支持 YFS 路径。

```
YFSCMD [+data/yas_db/] > ls
EXAMPLE.1
EXAMPLE.2
EXAMPLE.3
YFSCMD [+data/yas_db/] > vim EXAMPLE.1
# Now you enter vim TUI
# :wq to save and quit
YFSCMD [+data/yas_db/] >
```

### 4.2.11 md5sum

计算文件 md5，与 Linux 系统 md5sum 计算结果一致，可用于校验文件。

```
md5sum file
```

|Option|Description|
|:---|:---|
|file|文件路径。|


仅支持 YFS 路径。

```
YFSCMD [+data/yas_db/] > ls
EXAMPLE.1
EXAMPLE.2
EXAMPLE.3
YFSCMD [+data/yas_db/] > md5sum EXAMPLE.1
7b80f36a022737f922520629c0bfc74e *-
```

### 4.2.12 cat

读出文件到标准输出，编写脚本是，与 Linux shell 工具组合使用  **。**

```
cat file
```

|Option|Description|
|:---|:---|
|file|文件路径。|


仅支持 YFS 路径。

```
# Linux shell
yfscmd cat EXAMPLE.1 | awk '{}'
```

### 4.2.13 bash

在 yfscmd 中直接运行 shell 指令  **。**

```
bash cmds
```

|Option|Description|
|:---|:---|
|cmds|任何 shell 支持的单行脚本，允许使用管道，与 shell 下运行结果一致。|


仅支持 YFS 路径， cmd 参数不允许空白，目前暂不支持引号。

```
YFSCMD [+] > bash ps -eaf | grep yfs
root     105857 105856  1 00:04 pts/0    00:00:25 yfssrv -H /home/mayong/YFS_HOME -F
root     107808  49387  0 00:31 pts/4    00:00:00 yfscmd
root     107922 107808  0 00:36 pts/4    00:00:00 bash -c ps -eaf | grep yfs 
root     107924 107922  0 00:36 pts/4    00:00:00 grep yfs
```

### 4.2.14 help

查看帮助，注意，help 和 ? 等效  **。**

```
[help|?] [cmd]
```

|Option|Description|
|:---|:---|
|cmd|命令名称。|


指定 cmd 时，显示该命令帮助信息，否则打印命令清单。

```
YFSCMD [+] > help
exit   clear      cd    help       ?
ls      mv      rm   touch

YFSCMD [+] > ?
exit   clear      cd    help       ?
ls      mv      rm   touch

YFSCMD [+] > help exit
exit:
  usage: exit
quit YFSCMD shell.

YFSCMD [+] > ? touch
touch:
  usage: touch <file>
create an empty file.
```

## 4.3 高级特性

功能暂未提供。

### ~~4.3.1 自动补全~~

~~目前支持的的补全：~~

- ~~命令补全~~
- ~~对目录文件，如需完整的路径补全，可稍晚加需求。~~


### ~~4.3.2 提示~~

~~所有命令支持 Hint。~~

### ~~4.3.3 高亮~~

~~ls 时对目录蓝色高亮，与操作系统习惯一致。~~

~~错误信息红色高亮。~~

# 5. 测试用例

删除线表示暂未支持，无需测试。

## 5.1 文件操作

- 创建文件
- 复制文件
    - ext4 向 YFS 复制文件
    - YFS 向 ext4 复制文件
    - YFS 内部复制文件
- 删除文件
- ~~查看文件属性~~
    - ~~类型~~
    - ~~大小~~
    - ~~创建时间~~


## 5.2 目录操作

- 创建目录
- 删除空目录
- 遍历目录成员
- ~~查看目录属性~~
    - ~~创建时间~~
- 查看目录大小（递归计算包含目录、文件总大小）


# 6. 工作量

  


# 7. TODO

  


## Attachments:

[image2022-11-11_15-57-27.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZWVhMWFkOWEzMzExZGM3ZTY3IiwicmVmX2lkIjoiNjczOTZhZWU1OTNmOTljOWZmMjM1YjU2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwMjE5LCJleHAiOjE3ODIzNzY2MTl9.U4G2R575IhB7BWW237UDrTeb0QMw_-_DKah3ykhmeus)

 (image/png)    


[image2022-11-11_15-58-19.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZWU4OTcwYzJhZjRmNTFmZmYxIiwicmVmX2lkIjoiNjczOTZhZWU1OTNmOTljOWZmMjM1YjU2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwMjE5LCJleHAiOjE3ODIzNzY2MTl9.F2ICDYVah1L8cZumJi4uvmZsAm14xIZrMdX65Q4sytI)

 (image/png)    


[image2022-11-11_16-32-53.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZWU4OTcwYzJhZjRmNTFmZmYyIiwicmVmX2lkIjoiNjczOTZhZWU1OTNmOTljOWZmMjM1YjU2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwMjE5LCJleHAiOjE3ODIzNzY2MTl9.uDK3LCH8QROOa4BdA6dbtRlWSQxf1FDbBbCKkjWQctk)

 (image/png)    


[image2022-11-11_16-35-32.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZWU4OTcwYzJhZjRmNTFmZmYzIiwicmVmX2lkIjoiNjczOTZhZWU1OTNmOTljOWZmMjM1YjU2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwMjE5LCJleHAiOjE3ODIzNzY2MTl9.4ybt2IzNl1HHQBczWYlTd0n68eS4GdVhLdbgM9fQudU)

 (image/png)    


[image2022-11-11_17-19-6.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZWVhMWFkOWEzMzExZGM3ZTZiIiwicmVmX2lkIjoiNjczOTZhZWU1OTNmOTljOWZmMjM1YjU2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwMjE5LCJleHAiOjE3ODIzNzY2MTl9.28t4gj6bWBcr1i4fHkILyG0GSAoJYRxoiuQdBGEdfVw)

 (image/png)    


[image2022-11-14_18-3-12.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZWY4OTcwYzJhZjRmNTFmZmY4IiwicmVmX2lkIjoiNjczOTZhZWU1OTNmOTljOWZmMjM1YjU2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwMjE5LCJleHAiOjE3ODIzNzY2MTl9.JfB7CmaAUTEdrcuvoO6hkIByqn3d0S0a7OdM0ySQNzQ)

 (image/png)    


## Comments:

|  [](null)  ,方案的写作套路，一般是针对方案一、方案二分别给出描述，最后搞个表格对比方案一和方案二各自的优缺点，最后给一个决策建议,Posted by liuyuyun at 十一月 14, 2022 10:37|
|---|
|  [](null)  ,嗯，我会注意的，谢谢。,Posted by mayong at 十一月 14, 2022 11:27|
|  [](null)  ,需要明确这些约束条件：,- 命令行长度限制 <4K - 1>
- 参数个数限制     <无上限，但目前仅支持最少数量，比如 ls 仅支持 1 个参数>
- 参数长度限制      <32>
,Posted by mayong at 十一月 18, 2022 16:42|
|  [](null)  ,会新增创建文件的命令,touch filename,<已实现 touch 命令>,Posted by mayong at 十一月 18, 2022 16:42|
|  [](null)  ,需求：,1. 查看文件 <已新增  vim 支持>
1. 校验文件 <已新增 md5sum 支持>
,Posted by mayong at 十一月 22, 2022 10:53|
|  [](null)  ,可以作为一种文件系统挂载到现有的操作系统的文件系统上吗？那样的话都不用编写相应的cli了，现有系统api也可复用,Posted by lizuolong at 七月 20, 2023 15:50|
