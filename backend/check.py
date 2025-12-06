#!/usr/bin/env python3
import cv2
import numpy as np
from pathlib import Path
import sys

def diagnostic_check():
    # 1. 确定路径
    current_dir = Path(__file__).resolve().parent
    image_path = current_dir / "testimage.png" # 你的大图
    
    # 检查大图
    if not image_path.exists():
        print(f"❌ 大图缺失: {image_path}")
        return
    
    img = cv2.imread(str(image_path))
    h, w = img.shape[:2]
    print(f"\n🖼️  大图尺寸: {w} x {h} (如果在Mac上很大，说明是Retina截图)")
    
    # 2. 定义你要测试的模板
    # 请确保你的文件夹里有这些文件，文件名必须一模一样！
    templates = {
        "现金": "template_cash.png",
        "获得经验": "template_exp.png",
        "储备金": "template_reserve.png"
    }
    
    print("-" * 50)
    print(f"{'任务名':<10} | {'文件名':<20} | {'状态':<10} | {'匹配分数 (0-1)':<15}")
    print("-" * 50)
    
    for name, filename in templates.items():
        t_path = current_dir / filename
        
        # 检查模板文件是否存在
        if not t_path.exists():
            print(f"{name:<10} | {filename:<20} | ❌ 缺失 | N/A")
            continue
            
        t_img = cv2.imread(str(t_path))
        if t_img is None:
            print(f"{name:<10} | {filename:<20} | ❌ 坏图 | N/A")
            continue
            
        th, tw = t_img.shape[:2]
        
        # 核心：检查尺寸比例
        # 如果模板比大图还大，肯定是错的
        if th > h or tw > w:
             print(f"{name:<10} | {filename:<20} | ⚠️ 尺寸过大 | 模板比大图还大!")
             continue

        # 进行匹配
        res = cv2.matchTemplate(img, t_img, cv2.TM_CCOEFF_NORMED)
        min_val, max_val, min_loc, max_loc = cv2.minMaxLoc(res)
        
        # 输出结果
        status = "✅ 匹配" if max_val > 0.8 else "⚠️ 失败"
        print(f"{name:<10} | {filename:<20} | {status} | {max_val:.4f}")
        
        if max_val < 0.8:
            print(f"   ↳ 原因猜测: 分数太低。模板尺寸: {tw}x{th}")
            if max_val > 0.4:
                print("   ↳ 提示: 分数接近0.5，可能是背景干扰，建议只截文字，不要边框。")
            else:
                print("   ↳ 提示: 分数极低，极大概率是**分辨率缩放**问题 (Retina屏幕)。")

    print("-" * 50)
    print("💡 修复建议：请务必从 [testimage.png] 这张图里直接裁剪模板，不要重新截图。")

if __name__ == "__main__":
    diagnostic_check()