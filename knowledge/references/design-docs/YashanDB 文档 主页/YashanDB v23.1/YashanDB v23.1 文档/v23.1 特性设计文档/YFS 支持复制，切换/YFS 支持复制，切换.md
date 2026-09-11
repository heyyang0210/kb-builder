Created by 高风朴, last modified on 六月 16, 2023

## 1. Overview（概述）

yfs通过复制机制，保证主备间数据一致。所有的更新请求，统一有主机处理。处理完毕后，产生redo日志，发送刚给备机，备机回放redo。完成主备数据同步。

yfs通过ycs选主，被动接受ycs的topo。根据topo变化，完成主备切换。

## 2. Features（功能特性）

通过数据同步，完成主备数据一致。保证yfs在任何时候，数据强一致性。

主备切换。

## 3. Interfaces（接口）

不对外暴露接口

## 4. Limitations（功能限制）

目前，节点个数限制在4个以内。复制过程暂不考虑节点故障。

切换只支持计划内切换，对kill等，尤其是二次故障。暂不支持。

## 5. Detail Design（详细设计）

详细设计参考 《    [YFS 节点间同步 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=113972956)      [》](https://conf.yasdb.com/pages/viewpage.action?pageId=113972956)  

《    [YFS HA - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/display/YAS/YFS+HA)    》

## 6. Testcases（用例）

## 7. Workload（工作量）

## 8. TODO（遗留问题）