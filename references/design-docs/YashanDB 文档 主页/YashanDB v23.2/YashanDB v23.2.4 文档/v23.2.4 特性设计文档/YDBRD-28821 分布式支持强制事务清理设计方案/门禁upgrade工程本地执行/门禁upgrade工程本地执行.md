Created by 何阳 on 七月 23, 2024

##   [1.拉anchor_regress测试用例仓](#1拉anchor-regress测试用例仓)  

```
git clone git@git.yasdb.com:cod-x/anchor_regress.git

```

##   [2.执行升级测试脚本](#2执行升级测试脚本)  

```
## 生成tar包
python build.py package -o ./

## 解压到指定的path目录

## 到指定目录去执行升级脚本
cd ha_regress

## path为生成的tar包解压的目录
python3 upgrade_test.py ${path}

```

##   [3.查看执行失败的原因](#3查看执行失败的原因)  

```
cd ha_regress
vim ./upgrade_test.py.log

```

  
